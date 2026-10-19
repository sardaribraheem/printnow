package expo.modules.printnowpdf

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PrintNowPdfModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PrintNowPdf")
    OnCreate {
      appContext.reactContext?.cacheDir?.listFiles()
        ?.filter { it.name.startsWith("printnow-view-") }?.forEach { it.delete() }
    }
    AsyncFunction("inspectLocalFile") { uri: String, kind: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("App is unavailable")
      LocalFiles.inspect(context, uri, kind)
    }
    View(PrintNowPdfView::class) {
      Prop("source") { view: PrintNowPdfView, source: Map<String, String> ->
        view.load(source["uri"] ?: "", source["token"] ?: "")
      }
    }
  }
}
