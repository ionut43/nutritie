package expo.modules.nutriocr

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.net.Uri
import android.os.Build
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/** OCR cu Google ML Kit, pe telefon. Recunoașterea mâncării din poză rulează în WebView (vezi src/ui/VisionHost.tsx). */
class NutriOcrModule : Module() {
  private fun filePath(uri: String): String =
    if (uri.startsWith("file://")) Uri.parse(uri).path ?: uri.removePrefix("file://") else uri

  private fun reasonName(r: Int): String = when (r) {
    ApplicationExitInfo.REASON_CRASH -> "crash Java/Kotlin"
    ApplicationExitInfo.REASON_CRASH_NATIVE -> "crash nativ (C/C++)"
    ApplicationExitInfo.REASON_ANR -> "aplicația nu a mai răspuns (ANR)"
    ApplicationExitInfo.REASON_LOW_MEMORY -> "închisă de sistem: memorie puțină"
    ApplicationExitInfo.REASON_EXIT_SELF -> "s-a închis singură"
    ApplicationExitInfo.REASON_SIGNALED -> "oprită de un semnal"
    ApplicationExitInfo.REASON_USER_REQUESTED -> "oprită de utilizator"
    ApplicationExitInfo.REASON_USER_STOPPED -> "oprită din setări"
    ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "prea multe resurse"
    ApplicationExitInfo.REASON_OTHER -> "alt motiv"
    else -> "motiv $r"
  }

  override fun definition() = ModuleDefinition {
    Name("NutriOcr")

    /** de ce s-a închis aplicația ultimele ori (Android 11+): ajută să aflăm ce se întâmplă cu camera */
    Function("lastExits") {
      val out = mutableListOf<Map<String, Any?>>()
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          val ctx = appContext.reactContext ?: return@Function out
          val am = ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
          for (e in am.getHistoricalProcessExitReasons(ctx.packageName, 0, 5)) {
            var trace: String? = null
            if (e.reason == ApplicationExitInfo.REASON_ANR || e.reason == ApplicationExitInfo.REASON_CRASH) {
              try { trace = e.traceInputStream?.bufferedReader()?.use { it.readText().take(6000) } } catch (_: Throwable) {}
            } else if (e.reason == ApplicationExitInfo.REASON_CRASH_NATIVE) {
              // tombstone (protobuf): păstrez doar textul lizibil, ca să se vadă biblioteca și funcția care a căzut
              try {
                val bytes = e.traceInputStream?.use { it.readBytes() }
                if (bytes != null) {
                  val runs = Regex("[\\x20-\\x7E]{6,}").findAll(String(bytes, Charsets.ISO_8859_1)).map { it.value }
                    .filter { it.contains(".so") || it.contains("signal") || it.contains("SIG") || it.contains("Abort") || it.contains("fault") }
                    .distinct().take(40).toList()
                  trace = runs.joinToString("\n").take(6000)
                }
              } catch (_: Throwable) {}
            }
            out.add(mapOf(
              "time" to e.timestamp.toDouble(), "reason" to reasonName(e.reason), "process" to e.processName, "code" to e.reason,
              "description" to (e.description ?: ""), "status" to e.status, "importance" to e.importance,
              "pss" to e.pss.toDouble(), "rss" to e.rss.toDouble(), "trace" to trace,
            ))
          }
        }
      } catch (_: Throwable) {}
      out
    }

    AsyncFunction("recognize") { uriString: String, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("Context indisponibil")
        val uri = if (uriString.startsWith("content://") || uriString.startsWith("file://")) {
          Uri.parse(uriString)
        } else {
          Uri.fromFile(File(uriString))
        }
        val image = InputImage.fromFilePath(context, uri)
        val w = image.width.toDouble().coerceAtLeast(1.0)
        val h = image.height.toDouble().coerceAtLeast(1.0)
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
          .process(image)
          .addOnSuccessListener { result ->
            val lines = result.textBlocks.flatMap { it.lines }.map { line ->
              val r = line.boundingBox
              mapOf(
                "text" to line.text,
                "x" to (r?.left ?: 0) / w,
                "y" to (r?.top ?: 0) / h,
                "w" to (r?.width() ?: 0) / w,
                "h" to (r?.height() ?: 0) / h
              )
            }
            promise.resolve(lines)
          }
          .addOnFailureListener { e ->
            promise.reject(CodedException("ERR_OCR", e.message ?: "OCR eșuat", e))
          }
      } catch (e: Exception) {
        promise.reject(CodedException("ERR_OCR", e.message ?: "OCR eșuat", e))
      }
    }

  }
}
