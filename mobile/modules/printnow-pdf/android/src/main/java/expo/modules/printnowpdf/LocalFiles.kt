package expo.modules.printnowpdf

import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import java.io.File
import java.io.IOException

/** Access is limited to copies created by PrintNow's document picker. */
internal object LocalFiles {
  fun selected(context: Context, source: String): File {
    val uri = Uri.parse(source)
    if (uri.scheme != "file" || !uri.authority.isNullOrEmpty() ||
      uri.query != null || uri.fragment != null) throw IOException("Invalid local file")
    val directory = File(context.cacheDir, "printnow-selected").canonicalFile
    val file = File(uri.path ?: throw IOException("Missing file")).canonicalFile
    if (file.parentFile != directory || !file.isFile || file.length() !in 1L..(25L * 1024 * 1024))
      throw IOException("Selected file is unavailable or exceeds 25 MiB")
    return file
  }

  fun inspect(context: Context, source: String, expectedKind: String): Map<String, Any> {
    val file = selected(context, source)
    val header = file.inputStream().use { input ->
      val bytes = ByteArray(8)
      val count = input.read(bytes)
      bytes.copyOf(count.coerceAtLeast(0))
    }
    val kind = when {
      header.size >= 5 && header.copyOfRange(0, 5).contentEquals("%PDF-".toByteArray()) -> "pdf"
      header.contentEquals(byteArrayOf(137.toByte(), 80, 78, 71, 13, 10, 26, 10)) -> "png"
      header.size >= 3 && header[0] == 255.toByte() && header[1] == 216.toByte() && header[2] == 255.toByte() -> "jpeg"
      else -> throw IOException("Choose a valid PDF, PNG or JPEG file")
    }
    if (kind != expectedKind) throw IOException("File contents do not match its extension")
    if (kind == "pdf") {
      try {
        ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
          PdfRenderer(descriptor).use { renderer ->
            val pages = renderer.pageCount
            if (pages !in 1..10000) throw IOException("Unsupported PDF page count")
            return mapOf("kind" to kind, "pages" to pages)
          }
        }
      } catch (_: Exception) {
        throw IOException("This PDF cannot be opened. Choose an unencrypted, valid PDF.")
      }
    }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0 ||
      bounds.outWidth.toLong() * bounds.outHeight > 40000000L)
      throw IOException("Choose a valid image no larger than 40 megapixels")
    return mapOf("kind" to kind, "pages" to 1, "width" to bounds.outWidth, "height" to bounds.outHeight)
  }
}
