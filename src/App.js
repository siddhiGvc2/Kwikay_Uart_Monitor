import { useState } from "react";
import "./App.css";

export default function App() {
  const [port, setPort] = useState(null);
  const [writer, setWriter] = useState(null);
  const [reader, setReader] = useState(null);
  const [uartData, setUartData] = useState("");
  const [msg, setMsg] = useState("");

  // Connect to UART
  const connectSerial = async () => {
    try {
      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate: 115200 });
      setPort(selectedPort);

      // Setup writer
      const writer = selectedPort.writable.getWriter();
      setWriter(writer);

      // Setup reader
      const reader = selectedPort.readable.getReader();
      setReader(reader);

      const decoder = new TextDecoder();

      const readLoop = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              setUartData((prev) => prev + decoder.decode(value));
            }
          }
        } catch (err) {
          console.error("Read loop stopped:", err);
        } finally {
          reader.releaseLock();
        }
      };

      readLoop();
    } catch (err) {
      console.error("Error connecting to UART:", err);
    }
  };

  // Disconnect UART + clear terminal
  const disconnectSerial = async () => {
    try {
      if (reader) {
        await reader.cancel();
        reader.releaseLock();
        setReader(null);
      }
      if (writer) {
        writer.releaseLock();
        setWriter(null);
      }
      if (port) {
        await port.close();
        setPort(null);
      }
      setUartData(""); // 🟢 Clear terminal data on disconnect
      console.log("✅ Disconnected from UART and cleared data");
    } catch (err) {
      console.error("Error disconnecting:", err);
    }
  };

  // Send message
  const sendSerial = async () => {
    if (!writer) return;
    try {
      await writer.write(new TextEncoder().encode(msg + "\n"));
      setMsg("");
    } catch (err) {
      console.error("Send error:", err);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">UART Dashboard</h1>

        {!port ? (
          <div className="center">
            <button onClick={connectSerial} className="btn connect">
              Connect UART
            </button>
          </div>
        ) : (
          <div className="center">
            <button onClick={disconnectSerial} className="btn disconnect">
              Disconnect
            </button>
          </div>
        )}

        <div className="send-section">
          <input
            type="text"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Enter UART command"
            className="input"
          />
          <button onClick={sendSerial} className="btn send">
            Send
          </button>
        </div>

        <h2 className="subtitle">Incoming UART Data:</h2>
        <div className="terminal">
          <pre>{uartData || "No data yet..."}</pre>
        </div>
      </div>
    </div>
  );
}
