package expo.modules.printnowpdf

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.view.Gravity
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.min

/** Private, bounded, in-app PDF viewing using the Android platform renderer. */
class PrintNowPdfView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  private val worker = Executors.newSingleThreadExecutor()
  private val generation = AtomicInteger()
  private val image = ImageView(context)
  private val status = TextView(context)
  private val previous = Button(context)
  private val next = Button(context)
  private var renderer: PdfRenderer? = null
  private var descriptor: ParcelFileDescriptor? = null
  private var privateFile: File? = null
  private var bitmap: Bitmap? = null
  private var uri = ""
  private var token = ""
  private var pageIndex = 0
  @Volatile private var disposed = false

  init {
    orientation = VERTICAL
    setBackgroundColor(Color.rgb(247, 248, 244))
    image.scaleType = ImageView.ScaleType.FIT_CENTER
    image.contentDescription = "Private PDF page"
    addView(image, LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f))
    status.gravity = Gravity.CENTER
    status.setTextColor(Color.rgb(24, 35, 31))
    status.textSize = 13f
    status.setPadding(12, 12, 12, 12)
    addView(status, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
    val controls = LinearLayout(context).apply { gravity = Gravity.CENTER; orientation = HORIZONTAL }
    previous.text = "Previous"
    previous.contentDescription = "Previous PDF page"
    next.text = "Next"
    next.contentDescription = "Next PDF page"
    controls.addView(previous, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
    controls.addView(next, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
    addView(controls, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
    previous.setOnClickListener { showPage(pageIndex - 1) }
    next.setOnClickListener { showPage(pageIndex + 1) }
    previous.isEnabled = false
    next.isEnabled = false
  }

  fun load(newUri: String, newToken: String) {
    if (uri == newUri && token == newToken) return
    uri = newUri; token = newToken
    val current = generation.incrementAndGet()
    status.text = "Opening private PDF…"
    val local = newUri.startsWith("file:")
    val url = if (local) null else try { URL(newUri) } catch (_: Exception) { fail(); return }
    if (!local && (url?.protocol != "https" || url?.userInfo != null || newToken.isBlank())) { fail(); return }
    worker.execute {
      try {
        closePdf()
        val file = if (local) LocalFiles.selected(context, newUri)
          else File.createTempFile("printnow-view-", ".pdf", context.cacheDir).also { privateFile = it }
        if (!local) {
        val connection = connection(url!!, newToken)
        try {
          if (connection.responseCode != 200 || connection.contentLengthLong > 64L * 1024 * 1024)
            throw IOException("Unavailable")
          connection.inputStream.use { input ->
            file.outputStream().use { output ->
              val buffer = ByteArray(32768)
              var total = 0L
              while (true) {
                if (disposed || Thread.currentThread().isInterrupted || generation.get() != current) throw IOException("Cancelled")
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                if (total > 64L * 1024 * 1024) throw IOException("Size limit")
                output.write(buffer, 0, count)
              }
            }
          }
        } finally { connection.disconnect() }
        }
        descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
        renderer = PdfRenderer(descriptor!!)
        if (renderer!!.pageCount !in 1..10000) throw IOException("Page limit")
        render(0, current)
      } catch (_: Exception) { closePdf(); post { if (!disposed && generation.get() == current) fail() } }
    }
  }

  private fun connection(url: URL, bearer: String): HttpURLConnection =
    (url.openConnection() as HttpURLConnection).apply {
      instanceFollowRedirects = false
      useCaches = false
      connectTimeout = 15000
      readTimeout = 30000
      setRequestProperty("Authorization", "Bearer " + bearer)
      setRequestProperty("Cache-Control", "no-store")
    }

  private fun showPage(index: Int) {
    val pdf = renderer ?: return
    if (index !in 0 until pdf.pageCount || disposed) return
    previous.isEnabled = false; next.isEnabled = false
    val current = generation.get()
    worker.execute {
      try {
        // Recheck access before rendering another page from the private local copy.
        if (uri.startsWith("file:")) {
          LocalFiles.selected(context, uri)
        } else {
          val check = connection(URL(uri), token)
          try { check.requestMethod = "HEAD"; if (check.responseCode != 200) throw IOException("Access changed") }
          finally { check.disconnect() }
        }
        render(index, current)
      } catch (_: Exception) { closePdf(); post { if (!disposed) fail() } }
    }
  }

  private fun render(index: Int, current: Int) {
    val pdf = renderer ?: return
    val pageCount = pdf.pageCount
    val result = pdf.openPage(index).use { page ->
      val scale = min(1400f / page.width, 2200f / page.height)
      Bitmap.createBitmap((page.width * scale).toInt().coerceAtLeast(1), (page.height * scale).toInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888).also {
        it.eraseColor(Color.WHITE)
        page.render(it, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
      }
    }
    post {
      if (disposed || generation.get() != current) { result.recycle(); return@post }
      val old = bitmap; bitmap = result
      image.setImageBitmap(result); old?.recycle()
      pageIndex = index
      status.text = "Page " + (index + 1) + " of " + pageCount
      previous.isEnabled = index > 0
      next.isEnabled = index + 1 < pageCount
    }
  }

  private fun fail() {
    image.setImageDrawable(null)
    bitmap?.recycle(); bitmap = null
    status.text = "This private PDF is unavailable. Return to the request and try again."
    previous.isEnabled = false; next.isEnabled = false
  }
  private fun closePdf() {
    try { renderer?.close() } catch (_: Exception) {}
    renderer = null
    try { descriptor?.close() } catch (_: Exception) {}
    descriptor = null
    privateFile?.delete(); privateFile = null
  }
  override fun onDetachedFromWindow() {
    disposed = true
    generation.incrementAndGet()
    // Serial cleanup follows the bounded in-flight read/render; no file handles race.
    worker.execute { closePdf() }
    worker.shutdown()
    image.setImageDrawable(null)
    bitmap?.recycle(); bitmap = null
    super.onDetachedFromWindow()
  }
}
