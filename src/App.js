import { useState } from "react";

export default function App() {
  const [port, setPort] = useState(null);
  const [data, setData] = useState("");

  const connectSerial = async () => {
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      setPort(port);

      const reader = port.readable.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          setData(prev => prev + new TextDecoder().decode(value));
        }
      }
    } catch (err) {
      console.error("Serial connection failed: ", err);
    }
  };

  const sendSerial = async (message) => {
    if (!port) return;
    const writer = port.writable.getWriter();
    await writer.write(new TextEncoder().encode(message + "\n"));
    writer.releaseLock();
  };

  return (
    <div className="p-4">
      <h1 className="text-xl">UART via Web Serial API</h1>
      <button 
        onClick={connectSerial} 
        className="p-2 bg-blue-500 text-white rounded"
      >
        Connect to COM Port
      </button>

      <button 
        onClick={() => sendSerial("Hello UART")} 
        className="p-2 bg-green-500 text-white rounded ml-2"
      >
        Send Data
      </button>

      <pre className="bg-gray-100 p-2 mt-4">{data}</pre>
    </div>
  );
}

