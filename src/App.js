import { useState, useRef, useEffect } from "react";
import "./App.css";


function transformMessage(msg) {
    const prefix = "*CHENA:";
    const suffix = "#";
    const core = msg.slice(prefix.length, -1); // "1:1:0:1:1:1:1"

    const parts = core.split(':'); // ['1', '1', '0', '1', '1', '1', '1']
    
    let result = [parts[0]]; // Keep the first part as-is ('1')

    for (let i = 1; i < parts.length; i++) {
        if (parts[i] === '1') {
            result.push((i + 1).toString());  // Position index +1
        }
    }

    return `${result.join(':')}`;
}





function InfoCard({ deviceInfo }) {
  const statusIndex = deviceInfo.ssid; // This holds ssids[0], i.e., "0", "1", "2", etc.


  return (
    <div className="info-card" style={{ padding: "10px", borderRadius: "5px" }}>
      <strong>SSID:</strong>{" "}
      <span style={{ color: statusIndex === "1" ? "green" : "red" }}>
        {deviceInfo.ssid1 || "-"}
      </span>{" "}
      <span style={{ color: statusIndex === "2" ? "green" : "red" }}>
        {deviceInfo.ssid2 || "-"}
      </span>{" "}
      <span style={{ color: statusIndex === "3" ? "green" : "red" }}>
        {deviceInfo.ssid3 || "-"}
      </span>
    </div>
  );
}

export default function App() {
  const [port, setPort] = useState(null);
  const [writer, setWriter] = useState(null);
  const [reader, setReader] = useState(null);
  const [uartData, setUartData] = useState("");
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState("Disconnected");

  // Parsed device info
  const [deviceInfo, setDeviceInfo] = useState({
    macId: "",
    fwVersion: "",
    serialNumber: "",
    ssid: "",
    ssid1: "",
    ssid2: "",
    ssid3: "",
    hbt_counter:0,
    hbt_timer:0,
    wifi_errors:0,
    tcp_errors:0,
    mqtt_errors:0,
    mqtt_status:"FAILED",
    tcp_status:"FAILED",
    wifi_status:"FAILED",
    wifi_failure_duration: "", // Store the duration
    wifi_failed_at: "", // Reset failure timestamp
    lastTc:"",
    lastPulses:"",
    tc:"",
    pulses:""

  });

  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [uartData]);

  // Parse terminal data into device info
  const parseDeviceInfo = (data) => {
    console.log(data);
  const info = { macId: "", fwVersion: "", serialNumber: "",ssid: "", ssid1: "",ssid2:"",ssid3:"" ,tc:"",pulses:"",lastTc:"",lastPulses:""};

 if (data.startsWith("*MAC:")) {
      console.log(data);
      // Remove *MAC: and any leading/trailing spaces
      const macLine = data.replace("*MAC:", "").trim();

      // Split by ':' — last part is Serial Number
      const parts = macLine.split(":");
      if (parts.length >= 7) {
        info.macId = parts.slice(0, 6).join(":");      // D4:8A:FC:C3:F0:34
        info.serialNumber = parts[6].replace(/#$/, "");                  // 999999
      }
    }  else if (data.startsWith("*FW:")) {
    let fwLine = data.replace("*FW:", "").trim();
    if (fwLine.startsWith("*")) fwLine = fwLine.substring(1); // remove leading *
    info.fwVersion = fwLine.split(" ")[0]; // take first word as version
  } else if (data.startsWith("*SSID")) {
      console.log(data);
      // Remove leading *SSID, and split by ','
      const ssidParts = data.replace("*SSID,", "").split(",");
      // Take elements from index 3 onward as actual SSIDs
      const ssids = ssidParts.slice(2).filter(Boolean); 
     
     
      info.ssid1 = ssids[1];// Join multiple SSIDs
      info.ssid2= ssids[2];
      info.ssid3=ssids[3].replace(/#$/, "");  
    }
    else if(data.startsWith("*HBT-")){
      console.log(data);
      setDeviceInfo((prev) => ({
        ...prev,
        hbt_counter: (prev.hbt_counter || 0) + 1,
        hbt_timer: 0,
      }));
       
    }
    else if(data.startsWith("*TCP-NOTOK#")){

       
    
      setDeviceInfo((prev) => {
         const lastStatus = prev.tcp_status;
         const tcp_errors =
            lastStatus === "SUCCESS"
              ? (prev.tcp_errors || 0) + 1
              : prev.tcp_errors || 0;

        

          return {
            ...prev,
            tcp_errors,
            tcp_status: "FAILED",
          };
       
      });
      
    }
     else if(data.startsWith("*TCP-OK#")){
      setDeviceInfo((prev) => ({
        ...prev,
        tcp_status:"SUCCESS"
      }));
    }
    else if (data.startsWith("*WiFi:")) {
      const now = Date.now();
      setDeviceInfo((prev) => {
        const failedAt = prev.wifi_failed_at || now;
        const timeDiffSeconds = Math.floor((now - failedAt) / 1000); // Time diff in seconds

        console.log("Time difference since failure:", timeDiffSeconds, "seconds");

        return {
          ...prev,
          ssid: data.replace("*WiFi:", "").replace("#", "").trim(),
          wifi_status: "SUCCESS",
          wifi_failure_duration: timeDiffSeconds, // Store the duration
          
        };
      });
    }

    else if (data.startsWith("*MQTT,")) {
      const match = data.match(/\*MQTT,(\d+)(?: (.+))?#/);
      const status = match && match[2] ? match[2].trim() : "SUCCESS";

      setDeviceInfo((prev) => {
        const lastStatus = prev.mqtt_status;
       
        const mqtt_errors =
          status === "FAILED" && lastStatus === "SUCCESS"
            ? (prev.mqtt_errors || 0) + 1
            : prev.mqtt_errors || 0;

        return {
          ...prev,
          mqtt_errors,
          mqtt_status: status,
        };
      });
     
      
    }
    else if(data.startsWith("*WiFi failed bit set"))
    {
        const now = Date.now(); 
        setDeviceInfo((prev) => {
         const lastStatus = prev.wifi_status;
         const wifi_errors =
            lastStatus === "SUCCESS"
              ? (prev.wifi_errors || 0) + 1
              : prev.wifi_errors || 0;

          console.log("WIFI LAST STATUS:", lastStatus);
          console.log("WIFI Status: FAILED");

          return {
            ...prev,
            wifi_errors,
            wifi_status: "FAILED",
            ssid:"0",
            wifi_failed_at: lastStatus === "SUCCESS" ? now : prev.wifi_failed_at,
          };
       
      });
    }
    else if(data.startsWith("*TC,"))
    {
      setDeviceInfo((prev) => ({
        ...prev,
        lastTc:prev.tc
      }));
      info.tc=data;
    }
    else if(data.startsWith("*CHENA"))
    {
       setDeviceInfo((prev) => ({
        ...prev,
        lastPulses:prev.pulses
      }));
      info.pulses=transformMessage(data);
    }



  // Update only non-empty values
  setDeviceInfo((prev) => ({
    macId: info.macId || prev.macId,
    serialNumber: info.serialNumber || prev.serialNumber,
    fwVersion: info.fwVersion || prev.fwVersion,
    ssid:info.ssid || prev.ssid,
    ssid1: info.ssid1 || prev.ssid1,
    ssid2: info.ssid2 || prev.ssid2,
    ssid3: info.ssid3 || prev.ssid3,
    hbt_counter:info.hbt_counter || prev.hbt_counter,
    hbt_timer:info.hbt_timer || prev.hbt_timer,
    wifi_errors:info.wifi_errors || prev.wifi_errors,
    tcp_errors:info.tcp_errors || prev.tcp_errors,
    mqtt_errors:info.mqtt_errors || prev.mqtt_errors,
    mqtt_status: info.mqtt_status || prev.mqtt_status,
    tcp_status:info.tcp_status || prev.tcp_status,
    wifi_status:info.wifi_status || prev.wifi_status,
    wifi_failure_duration: info.wifi_failure_duration || prev.wifi_failure_duration,
    wifi_failed_at: info.wifi_failed_at || prev.wifi_failed_at, // Reset failure timestamp
    tc:info.tc || prev.tc,
    pulses: info.pulses || prev.pulses,
    lastTc:info.lastTc || prev.lastTc,
    lastPulses:info.lastPulses || prev.lastPulses
    

  }));
};

useEffect(() => {
  let intervalId;

  if (status === "Connected") {
    intervalId = setInterval(() => {
      setDeviceInfo((prev) => ({
        ...prev,
        hbt_timer: (prev.hbt_timer || 0) + 1,
      }));
    }, 1000);
  } else {
    setDeviceInfo((prev) => ({
      ...prev,
      hbt_timer: 0,
    }));
  }

  // Cleanup function to clear interval when component unmounts or status changes
  return () => {
    if (intervalId) clearInterval(intervalId);
  };
}, [status]);

let uartBuffer = "";


  // Connect to UART
 const connectSerial = async () => {
  try {
    const selectedPort = await navigator.serial.requestPort();
    await selectedPort.open({ baudRate: 115200 });
    setPort(selectedPort);
    setStatus("Connected");

    // Setup writer
    const writer = selectedPort.writable.getWriter();
    setWriter(writer);

    // 🟢 Automatically send *RST# every time we connect/reconnect
    await writer.write(new TextEncoder().encode("*RST#\n"));
    setTimeout(async()=>{
      await writer.write(new TextEncoder().encode("*SSID?#\n"));
     
    },5000)

    setTimeout(async()=>{
      await writer.write(new TextEncoder().encode("*TC?#\n"));
      setTimeout(async()=>{
          await writer.write(new TextEncoder().encode("*PULSES?#\n"));
      },2000)
    
    },10000)

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
        const text = decoder.decode(value);
        setUartData((prev) => prev + text);

        uartBuffer += text;

        // ✅ Extract only complete messages like "*...#"
        const regex = /\*[^#]*#/g;
        let match;
        while ((match = regex.exec(uartBuffer)) !== null) {
          const line = match[0].trim(); // full message, e.g. "*HBT-S#"
          parseDeviceInfo(line);        // send to parser
        }

        // Keep only the leftover (after last #)
        const lastHash = uartBuffer.lastIndexOf("#");
        if (lastHash >= 0) {
          uartBuffer = uartBuffer.slice(lastHash + 1);
        }
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
    setStatus("Error");
  }
};


  // Disconnect UART
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
      setUartData("");
      setDeviceInfo({  macId: "",
    fwVersion: "",
    serialNumber: "",
    ssid: "",
    ssid1: "",
    ssid2: "",
    ssid3: "",
    hbt_counter:0,
    hbt_timer:0,
    wifi_errors:0,
    tcp_errors:0,
    mqtt_errors:0,
    mqtt_status:"FAILED",
    tcp_status:"FAILED",
    wifi_status:"FAILED",
    wifi_failure_duration: "", // Store the duration
    wifi_failed_at: "", // Reset failure timestamp
    tc:"",
    pulses:"",
    lastTc:"",
    lastPulses:"" });
      setStatus("Disconnected");
      console.log("✅ Disconnected and cleared data");
    } catch (err) {
      console.error("Error disconnecting:", err);
    }
  };

  const sendSerial = async () => {
    if (!writer || !msg) return;
    try {
      await writer.write(new TextEncoder().encode(msg + "\n"));
      if(msg.includes("*RST#"))
      {
         setDeviceInfo((prev) => ({
          ...prev,
          ssid: "0"
        }));
          setTimeout(async()=>{
          await writer.write(new TextEncoder().encode("*SSID?#\n"));
        },5000)
      }
      setMsg("");
    } catch (err) {
      console.error("Send error:", err);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">UART Dashboard</h1>

        {/* Status */}
        <p className={`status ${status === "Connected" ? "connected" : "disconnected"}`}>
          Status: {status}
        </p>

        {/* Connect / Disconnect */}
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

        {/* Send */}
        <div className="send-section">
          <input
            type="text"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Enter UART command"
            className="input"
          />
          <button onClick={sendSerial} className="btn send" disabled={!writer || !msg}>
            Send
          </button>
          <button
            onClick={() => {
              setUartData("");
              setDeviceInfo({ macId: "", fwVersion: "", serialNumber: "", ssid: "" });
            }}
            className="btn clear"
            disabled={!uartData}
          >
            Clear Terminal
          </button>
        </div>

        {/* Device Info Cards */}
        
        <div className="info-cards">
          <div className="info-card">
            <strong>ID:</strong> {deviceInfo.macId || "-"} / {deviceInfo.serialNumber || "-"} / {deviceInfo.fwVersion || "-"}
          </div>
           <InfoCard deviceInfo={deviceInfo} />
           <div className="info-card">
             <strong>HBT-S:</strong>  {deviceInfo.hbt_counter} / {deviceInfo.hbt_timer}
           </div>
              <div className="info-card">
             <strong>WIFI-FAILDED Time:</strong> {deviceInfo.wifi_failed_at || 0} {deviceInfo.wifi_failure_duration || 0}
           </div>
            <div className="info-card">
             <strong>TCP-ERRORS:</strong> {deviceInfo.tcp_errors || 0}
           </div>
            <div className="info-card">
             <strong>MQTT-ERRORS:</strong> {deviceInfo.mqtt_errors || 0}
           </div>
           <div className="info-card2">
             <strong>TC:</strong> {deviceInfo.tc || ""}
           </div>
           <div className="info-card2">
             <strong>PULSES:</strong> {deviceInfo.pulses || ""}
           </div>
           
        </div>

        {/* Terminal */}
        <h2 className="subtitle">Incoming UART Data:</h2>
        <div className="terminal" ref={terminalRef}>
          <pre>{uartData || "No data yet..."}</pre>
        </div>
      </div>
    </div>
  );
}
