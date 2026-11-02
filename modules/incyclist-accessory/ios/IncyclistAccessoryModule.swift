import ExpoModulesCore
import ExternalAccessory

/**
 * External Accessory (MFi) sessions as byte streams - used as the transport of the serial interface on iOS.
 *
 * Bluetooth Classic serial devices are not reachable from iOS apps, except MFi accessories via the External
 * Accessory framework. The Kettler Racer S is such an accessory (protocol com.kettler.s-fit); over its
 * session it speaks the same protocol as over a serial port on desktop.
 *
 * The protocol strings an app may use have to be declared in UISupportedExternalAccessoryProtocols of the
 * Info.plist - accessories with other protocols are not even listed.
 *
 * Data is passed as base64 strings in both directions.
 */
public class IncyclistAccessoryModule: Module {
    private var sessions: [Int: AccessorySession] = [:]
    private var nextSessionId = 1
    private var connectObserver: NSObjectProtocol?
    private var disconnectObserver: NSObjectProtocol?

    public func definition() -> ModuleDefinition {
        Name("IncyclistAccessory")

        Events("onData", "onClose", "onAccessoriesChanged")

        OnStartObserving {
            EAAccessoryManager.shared().registerForLocalNotifications()
            let center = NotificationCenter.default
            self.connectObserver = center.addObserver(forName: .EAAccessoryDidConnect, object: nil, queue: .main) { [weak self] _ in
                self?.sendEvent("onAccessoriesChanged", [:])
            }
            self.disconnectObserver = center.addObserver(forName: .EAAccessoryDidDisconnect, object: nil, queue: .main) { [weak self] _ in
                self?.sendEvent("onAccessoriesChanged", [:])
            }
        }

        OnStopObserving {
            [self.connectObserver, self.disconnectObserver].compactMap { $0 }.forEach {
                NotificationCenter.default.removeObserver($0)
            }
            self.connectObserver = nil
            self.disconnectObserver = nil
        }

        // connected accessories that support the given protocol
        Function("list") { (protocolString: String) -> [[String: Any]] in
            EAAccessoryManager.shared().connectedAccessories
                .filter { $0.protocolStrings.contains(protocolString) }
                .map { accessory in
                    [
                        "connectionId": accessory.connectionID,
                        "name": accessory.name,
                        "manufacturer": accessory.manufacturer,
                        "modelNumber": accessory.modelNumber,
                        "serialNumber": accessory.serialNumber,
                        "firmwareRevision": accessory.firmwareRevision,
                        "hardwareRevision": accessory.hardwareRevision,
                    ]
                }
        }

        // opens a session, returns the session id
        AsyncFunction("open") { (connectionId: Int, protocolString: String) throws -> Int in
            guard let accessory = EAAccessoryManager.shared().connectedAccessories.first(where: { $0.connectionID == connectionId }) else {
                throw AccessoryNotConnectedException(connectionId)
            }
            guard let session = EASession(accessory: accessory, forProtocol: protocolString) else {
                throw SessionNotOpenedException(protocolString)
            }
            let id = self.nextSessionId
            self.nextSessionId += 1

            let accessorySession = AccessorySession(session: session) { [weak self] event in
                self?.handle(event, sessionId: id)
            }
            self.sessions[id] = accessorySession
            accessorySession.open()
            return id
        }
        .runOnQueue(.main)

        AsyncFunction("write") { (sessionId: Int, base64: String) throws in
            guard let session = self.sessions[sessionId] else {
                throw SessionNotFoundException(sessionId)
            }
            guard let data = Data(base64Encoded: base64) else {
                throw InvalidDataException()
            }
            session.write(data)
        }
        .runOnQueue(.main)

        AsyncFunction("close") { (sessionId: Int) in
            self.sessions.removeValue(forKey: sessionId)?.close()
        }
        .runOnQueue(.main)
    }

    private func handle(_ event: AccessorySession.Event, sessionId: Int) {
        switch event {
        case .data(let data):
            sendEvent("onData", ["sessionId": sessionId, "data": data.base64EncodedString()])
        case .closed(let error):
            sessions.removeValue(forKey: sessionId)?.close()
            sendEvent("onClose", ["sessionId": sessionId, "error": error as Any])
        }
    }
}

/// One EASession; the streams are scheduled on the main run loop.
final class AccessorySession: NSObject, StreamDelegate {
    enum Event {
        case data(Data)
        case closed(String?)
    }

    private let session: EASession
    private let onEvent: (Event) -> Void
    private var pendingOut = Data()
    private var isClosed = false

    init(session: EASession, onEvent: @escaping (Event) -> Void) {
        self.session = session
        self.onEvent = onEvent
    }

    private var streams: [Stream] {
        [session.inputStream, session.outputStream].compactMap { $0 }
    }

    func open() {
        for stream in streams {
            stream.delegate = self
            stream.schedule(in: .main, forMode: .default)
            stream.open()
        }
    }

    func write(_ data: Data) {
        pendingOut.append(data)
        flush()
    }

    func close() {
        guard !isClosed else { return }
        isClosed = true
        for stream in streams {
            stream.close()
            stream.remove(from: .main, forMode: .default)
            stream.delegate = nil
        }
    }

    private func flush() {
        guard let out = session.outputStream else { return }
        while !pendingOut.isEmpty && out.hasSpaceAvailable {
            let written = pendingOut.withUnsafeBytes { buffer in
                out.write(buffer.bindMemory(to: UInt8.self).baseAddress!, maxLength: buffer.count)
            }
            if written <= 0 { break }
            pendingOut.removeFirst(written)
        }
    }

    func stream(_ aStream: Stream, handle eventCode: Stream.Event) {
        switch eventCode {
        case .hasBytesAvailable:
            guard let input = aStream as? InputStream else { return }
            var buffer = [UInt8](repeating: 0, count: 1024)
            var received = Data()
            while input.hasBytesAvailable {
                let count = input.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                received.append(buffer, count: count)
            }
            if !received.isEmpty {
                onEvent(.data(received))
            }
        case .hasSpaceAvailable:
            flush()
        case .errorOccurred:
            finish(aStream.streamError?.localizedDescription ?? "stream error")
        case .endEncountered:
            finish(nil)
        default:
            break
        }
    }

    private func finish(_ error: String?) {
        guard !isClosed else { return }
        close()
        onEvent(.closed(error))
    }
}

final class AccessoryNotConnectedException: GenericException<Int> {
    override var reason: String { "accessory \(param) is not connected" }
}

final class SessionNotOpenedException: GenericException<String> {
    override var reason: String { "could not open a session for protocol \(param) - is it declared in UISupportedExternalAccessoryProtocols?" }
}

final class SessionNotFoundException: GenericException<Int> {
    override var reason: String { "session \(param) is not open" }
}

final class InvalidDataException: Exception {
    override var reason: String { "data is not valid base64" }
}
