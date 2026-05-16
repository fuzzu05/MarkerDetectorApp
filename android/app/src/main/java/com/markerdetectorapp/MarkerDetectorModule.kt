package com.markerdetectorapp

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.opencv.android.OpenCVLoader
import org.opencv.core.*
import org.opencv.imgcodecs.Imgcodecs
import org.opencv.imgproc.Imgproc
import java.io.File
import java.util.ArrayList

class MarkerDetectorModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    init {
        if (!OpenCVLoader.initDebug()) {
            Log.e("OpenCV", "Unable to load OpenCV!")
        } else {
            Log.i("OpenCV", "OpenCV loaded successfully!")
        }
    }

    override fun getName(): String {
        return "MarkerDetector"
    }

    @ReactMethod
    fun processMarker(imagePath: String, promise: Promise) {
        try {
            val cleanPath = imagePath.replace("file://", "")
            var src = Imgcodecs.imread(cleanPath)
            if (src.empty()) {
                promise.reject("ERR_IMAGE", "Could not load image: $cleanPath")
                return
            }

            // Constraint #5: Live camera feed should be minimum 2000x2000px and maximum 3000x3000px
            val width = src.cols().toDouble()
            val height = src.rows().toDouble()
            var scale = 1.0

            if (width < 2000 || height < 2000) {
                scale = maxOf(2000.0 / width, 2000.0 / height)
            } else if (width > 3000 || height > 3000) {
                scale = minOf(3000.0 / width, 3000.0 / height)
            }

            if (scale != 1.0) {
                val resized = Mat()
                Imgproc.resize(src, resized, Size(width * scale, height * scale))
                src = resized
            }

            // 1. Grayscale & Blur
            val gray = Mat()
            Imgproc.cvtColor(src, gray, Imgproc.COLOR_BGR2GRAY)
            val blur = Mat()
            Imgproc.GaussianBlur(gray, blur, Size(5.0, 5.0), 0.0)

            // 2. Edge Detection
            val edges = Mat()
            Imgproc.Canny(blur, edges, 50.0, 150.0)

            // 3. Find Contours
            val contours = ArrayList<MatOfPoint>()
            val hierarchy = Mat()
            Imgproc.findContours(edges, contours, hierarchy, Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)

            // 4. Find largest 4-point contour (the marker border)
            var maxArea = 0.0
            var markerContour: MatOfPoint2f? = null

            for (contour in contours) {
                val contour2f = MatOfPoint2f(*contour.toArray())
                val peri = Imgproc.arcLength(contour2f, true)
                val approx = MatOfPoint2f()
                // Use 0.04 instead of 0.02! This forces slightly noisy/blurry lines to be approximated as a strict 4-point square, reducing dropped frames!
                Imgproc.approxPolyDP(contour2f, approx, 0.04 * peri, true)

                if (approx.total() == 4L) {
                    val area = Imgproc.contourArea(approx)
                    // Lowered area threshold to 2000 to catch markers even if the camera uses a lower-res fast-capture mode
                    if (area > maxArea && area > 2000) {
                        maxArea = area
                        markerContour = approx
                    }
                }
            }

            if (markerContour == null) {
                promise.reject("ERR_NO_MARKER", "No marker found in frame")
                return
            }

            // 5. Perspective Warp to a 300x300 flat square (Assignment Requirement)
            val warpSize = 300.0
            val srcPoints = sortCorners(markerContour)
            val dstPoints = MatOfPoint2f(
                Point(0.0, 0.0),
                Point(warpSize - 1, 0.0),
                Point(warpSize - 1, warpSize - 1),
                Point(0.0, warpSize - 1)
            )

            val transformMatrix = Imgproc.getPerspectiveTransform(srcPoints, dstPoints)
            val warped = Mat()
            Imgproc.warpPerspective(src, warped, transformMatrix, Size(warpSize, warpSize))

            // 6. Validate & Rotate using 20x20 orientation square
            val orientationCorner = findOrientationSquare(warped)
            if (orientationCorner == -1) {
                promise.reject("ERR_INVALID_MARKER", "Invalid Marker: Orientation square missing, oversized, or in center")
                return
            }

            // Rotate based on which corner it was found in to bring it to Top-Left (0)
            val finalImage = Mat()
            when (orientationCorner) {
                0 -> warped.copyTo(finalImage) // Already Top-Left
                1 -> Core.rotate(warped, finalImage, Core.ROTATE_90_COUNTERCLOCKWISE) // Top-Right -> rotate CCW
                2 -> Core.rotate(warped, finalImage, Core.ROTATE_180) // Bottom-Right -> rotate 180
                3 -> Core.rotate(warped, finalImage, Core.ROTATE_90_CLOCKWISE) // Bottom-Left -> rotate CW
            }

            // 7. Save to disk and return path
            val outputFile = File.createTempFile("extracted_marker_", ".jpg", reactApplicationContext.cacheDir)
            Imgcodecs.imwrite(outputFile.absolutePath, finalImage)

            promise.resolve("file://" + outputFile.absolutePath)

        } catch (e: Exception) {
            promise.reject("ERR_PROCESSING", e.message)
        }
    }

    // Helper: Sort 4 corners into Top-Left, Top-Right, Bottom-Right, Bottom-Left
    private fun sortCorners(corners: MatOfPoint2f): MatOfPoint2f {
        val points = corners.toArray().toList()
        val sortedByY = points.sortedBy { it.y }
        val topPoints = sortedByY.take(2).sortedBy { it.x }
        val bottomPoints = sortedByY.takeLast(2).sortedByDescending { it.x }
        
        return MatOfPoint2f(
            topPoints[0], // TL
            topPoints[1], // TR
            bottomPoints[0], // BR
            bottomPoints[1]  // BL
        )
    }

    // Helper: Find which corner has the orientation square
    // Returns 0=TL, 1=TR, 2=BR, 3=BL. Returns -1 if invalid.
    private fun findOrientationSquare(warped: Mat): Int {
        val gray = Mat()
        Imgproc.cvtColor(warped, gray, Imgproc.COLOR_BGR2GRAY)
        
        // Use Otsu's Threshold to automatically adapt to the Virtual Scene's lighting!
        val binary = Mat()
        Imgproc.threshold(gray, binary, 0.0, 255.0, Imgproc.THRESH_BINARY_INV or Imgproc.THRESH_OTSU)

        val contours = ArrayList<MatOfPoint>()
        val hierarchy = Mat()
        Imgproc.findContours(binary, contours, hierarchy, Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)

        val width = warped.cols().toDouble()
        val height = warped.rows().toDouble()
        
        // A 20x20 square in a 140x140 marker is roughly 14% of the width
        val expectedDim = width * (20.0 / 140.0) 

        for (contour in contours) {
            val rect = Imgproc.boundingRect(contour)
            val aspect = rect.width.toDouble() / rect.height
            val contourArea = Imgproc.contourArea(contour)
            val rectArea = rect.width.toDouble() * rect.height.toDouble()
            val extent = contourArea / rectArea
            
            // SUPER RELAXED FILTER:
            // 1. Aspect ratio: 0.6 to 1.4
            // 2. Width: 0.5x to 1.5x of expected
            // 3. Extent: > 0.50
            if (aspect in 0.6..1.4 && rect.width > expectedDim * 0.5 && rect.width < expectedDim * 1.5 && extent > 0.50) {
                
                val cx = rect.x + rect.width / 2.0
                val cy = rect.y + rect.height / 2.0
                
                // If it is located in the middle 40% of the image, it's invalid!
                if (cx > width * 0.3 && cx < width * 0.7 && cy > height * 0.3 && cy < height * 0.7) {
                    return -1 
                }

                // Identify corner
                if (cx < width / 2 && cy < height / 2) return 0 // TL
                if (cx >= width / 2 && cy < height / 2) return 1 // TR
                if (cx >= width / 2 && cy >= height / 2) return 2 // BR
                if (cx < width / 2 && cy >= height / 2) return 3 // BL
            }
        }
        return -1 // No valid square found
    }
}
