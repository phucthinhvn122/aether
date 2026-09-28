import Foundation
import Capacitor
import UIKit

/// Saves generated files (PDF, PPTX, sources) to a temp file and opens the iOS share sheet,
/// because WKWebView ignores `<a download>` links. "Save to Files" is one of the sheet's actions.
@objc(NativeSharePlugin)
public class NativeSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSharePlugin"
    public let jsName = "NativeShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareFile", returnType: CAPPluginReturnPromise),
    ]

    @objc func shareFile(_ call: CAPPluginCall) {
        guard let base64 = call.getString("data"), let data = Data(base64Encoded: base64) else {
            call.reject("Invalid file data")
            return
        }
        let requested = (call.getString("filename") ?? "")
            .replacingOccurrences(of: "/", with: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let filename = requested.isEmpty ? "file" : requested
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("exports", isDirectory: true)
        let url = directory.appendingPathComponent(filename)
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try data.write(to: url, options: .atomic)
        } catch {
            call.reject("Could not write file: \(error.localizedDescription)")
            return
        }

        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("No view controller to present from")
                return
            }
            let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            if let popover = sheet.popoverPresentationController {
                // iPad presents the sheet as a popover, which needs an anchor.
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }
            sheet.completionWithItemsHandler = { _, completed, _, _ in
                call.resolve(["completed": completed])
            }
            presenter.present(sheet, animated: true)
        }
    }
}
