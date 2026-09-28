import Foundation
import Capacitor

/// Streams HTTP responses through URLSession so the web layer is not subject to WKWebView CORS rules.
/// JS calls `start` (resolves with status + headers once they arrive), then receives
/// `chunk` (base64 bytes), `end` or `error` events tagged with the request id.
@objc(NativeHttpStreamPlugin)
public class NativeHttpStreamPlugin: CAPPlugin, CAPBridgedPlugin, URLSessionDataDelegate {
    public let identifier = "NativeHttpStreamPlugin"
    public let jsName = "NativeHttpStream"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
    ]

    private struct Pending {
        let id: String
        var call: CAPPluginCall?
    }

    // All mutable state is only touched on this serial queue (also the URLSession delegate queue).
    private let queue: OperationQueue = {
        let q = OperationQueue()
        q.maxConcurrentOperationCount = 1
        return q
    }()
    private var session: URLSession?
    private var byTask: [Int: Pending] = [:]
    private var byId: [String: URLSessionDataTask] = [:]

    private func urlSession() -> URLSession {
        if let session { return session }
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 600
        config.timeoutIntervalForResource = 3600
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        let created = URLSession(configuration: config, delegate: self, delegateQueue: queue)
        session = created
        return created
    }

    @objc func start(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let urlString = call.getString("url"),
              let url = URL(string: urlString) else {
            call.reject("Invalid URL")
            return
        }
        var request = URLRequest(url: url)
        request.httpMethod = call.getString("method") ?? "GET"
        if let headers = call.getObject("headers") {
            for (name, value) in headers {
                if let text = value as? String { request.setValue(text, forHTTPHeaderField: name) }
            }
        }
        if let body = call.getString("body") {
            request.httpBody = body.data(using: .utf8)
        }
        queue.addOperation {
            let task = self.urlSession().dataTask(with: request)
            self.byTask[task.taskIdentifier] = Pending(id: id, call: call)
            self.byId[id] = task
            task.resume()
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        queue.addOperation {
            self.byId[id]?.cancel()
        }
        call.resolve()
    }

    public func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive response: URLResponse,
        completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
    ) {
        if var pending = byTask[dataTask.taskIdentifier], let call = pending.call {
            var headers: JSObject = [:]
            var status = 200
            if let http = response as? HTTPURLResponse {
                status = http.statusCode
                for (key, value) in http.allHeaderFields {
                    headers[String(describing: key).lowercased()] = String(describing: value)
                }
            }
            call.resolve(["status": status, "headers": headers])
            pending.call = nil
            byTask[dataTask.taskIdentifier] = pending
        }
        completionHandler(.allow)
    }

    public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard let pending = byTask[dataTask.taskIdentifier] else { return }
        notifyListeners("chunk", data: ["id": pending.id, "data": data.base64EncodedString()])
    }

    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let pending = byTask.removeValue(forKey: task.taskIdentifier) else { return }
        byId.removeValue(forKey: pending.id)
        guard let error else {
            notifyListeners("end", data: ["id": pending.id])
            return
        }
        let nsError = error as NSError
        let message = nsError.code == NSURLErrorCancelled ? "aborted" : nsError.localizedDescription
        if let call = pending.call {
            call.reject(message, String(nsError.code))
        } else {
            notifyListeners("error", data: ["id": pending.id, "message": message])
        }
    }
}
