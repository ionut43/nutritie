import ExpoModulesCore
import UIKit
import Vision

/// OCR pe telefon cu Apple Vision. Recunoașterea mâncării din poză rulează în WebView (src/ui/VisionHost.tsx).
public class NutriOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NutriOcr")

    AsyncFunction("recognize") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        let url = uri.hasPrefix("file://") ? URL(string: uri) : URL(fileURLWithPath: uri)
        guard let fileUrl = url, let data = try? Data(contentsOf: fileUrl), let image = UIImage(data: data), let cg = image.cgImage else {
          promise.reject("ERR_IMAGE", "Nu pot citi imaginea")
          return
        }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        if let supported = try? request.supportedRecognitionLanguages() {
          let wanted = ["ro-RO", "en-US"].filter { supported.contains($0) }
          if !wanted.isEmpty { request.recognitionLanguages = wanted }
        }
        let handler = VNImageRequestHandler(cgImage: cg, orientation: .up, options: [:])
        do {
          try handler.perform([request])
        } catch {
          promise.reject("ERR_OCR", error.localizedDescription)
          return
        }
        let observations = request.results ?? []
        var lines: [[String: Any]] = []
        for o in observations {
          guard let c = o.topCandidates(1).first else { continue }
          let b = o.boundingBox
          lines.append([
            "text": c.string,
            "x": Double(b.minX),
            "y": Double(1 - b.maxY),
            "w": Double(b.width),
            "h": Double(b.height),
          ])
        }
        promise.resolve(lines)
      }
    }

  }
}
