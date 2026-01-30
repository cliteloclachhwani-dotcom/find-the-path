// Function to generate the Excel/CSV Audit Report
window.downloadExcelAudit = function() {
    if (!window.rtis || window.rtis.length === 0) return alert("Pehle Step 1: Map Generate karein!");
    
    const stnF = document.getElementById('s_from').value;
    const stnT = document.getElementById('s_to').value;
    const dir = determineDirection(stnF, stnT); // Uses logic from mapping.js

    let csv = `Audit Report: ${stnF} to ${stnT} (${dir} Movement)\n`;
    csv += "Asset Type,Signal Name,Crossing Speed (Kmph),Crossing Time\n";

    let auditLog = [];

    // Filter signals based on direction and matching RTIS slice
    window.master.sigs.forEach(sig => {
        if (!sig.type.startsWith(dir)) return;

        let sLt = conv(getVal(sig, ['Lat']));
        let sLg = conv(getVal(sig, ['Lng']));
        let name = getVal(sig, ['SIGNAL_NAME']);

        // Check proximity within the sliced RTIS data
        let match = window.rtis.filter(p => 
            Math.sqrt(Math.pow(p.lt - sLt, 2) + Math.pow(p.lg - sLg, 2)) < 0.002
        );

        if (match.length > 0) {
            // Find the point of closest approach
            match.sort((a, b) => 
                Math.sqrt(Math.pow(a.lt - sLt, 2) + Math.pow(a.lg - sLg, 2)) - 
                Math.sqrt(Math.pow(b.lt - sLt, 2) + Math.pow(b.lg - sLg, 2))
            );

            auditLog.push({
                name: name,
                spd: match[0].spd.toFixed(1),
                time: getVal(match[0].raw, ['Time', 'Logging Time']) || "N/A",
                index: window.rtis.indexOf(match[0])
            });
        }
    });

    // Sort by sequence of travel (RTIS index)
    auditLog.sort((a, b) => a.index - b.index).forEach(r => {
        csv += `SIGNAL,${r.name},${r.spd},${r.time}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Audit_${stnF}_to_${stnT}.csv`;
    a.click();
};

// Function to generate the Interactive Web Report
window.saveInteractiveWebReport = function() {
    if (!window.rtis || window.rtis.length === 0) return alert("Pehle Step 1: Map Generate karein!");

    const stnF = document.getElementById('s_from').value;
    const stnT = document.getElementById('s_to').value;
    const dir = determineDirection(stnF, stnT);

    let reportData = [];
    window.master.sigs.forEach(sig => {
        if (!sig.type.startsWith(dir)) return;
        let sLt = conv(getVal(sig, ['Lat']));
        let sLg = conv(getVal(sig, ['Lng']));
        
        let match = window.rtis.filter(p => Math.sqrt(Math.pow(p.lt - sLt, 2) + Math.pow(p.lg - sLg, 2)) < 0.002);
        if (match.length > 0) {
            match.sort((a, b) => Math.sqrt(Math.pow(a.lt - sLt, 2) + Math.pow(a.lg - sLg, 2)) - Math.sqrt(Math.pow(b.lt - sLt, 2) + Math.pow(b.lg - sLg, 2)));
            reportData.push({
                n: getVal(sig, ['SIGNAL_NAME']),
                s: match[0].spd.toFixed(1),
                t: getVal(match[0].raw, ['Time', 'Logging Time']) || "N/A",
                lt: sLt,
                lg: sLg,
                idx: window.rtis.indexOf(match[0])
            });
        }
    });

    reportData.sort((a, b) => a.idx - b.idx);

    // Build the standalone HTML Report
    let listItems = reportData.map(r => `
        <div class="card" onclick="m.setView([${r.lt}, ${r.lg}], 16)">
            <div class="sig-name">${r.n}</div>
            <div class="sig-data">Speed: <b>${r.s} Kmph</b> | Time: ${r.t}</div>
        </div>
    `).join('');

    let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Audit: ${stnF}-${stnT}</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
            body { margin:0; display:flex; font-family:sans-serif; height:100vh; background:#f4f4f4; }
            #side { width:350px; overflow-y:auto; padding:20px; background:#002f6c; color:white; }
            #map { flex:1; }
            .card { background:rgba(255,255,255,0.1); padding:12px; margin-bottom:10px; border-radius:5px; cursor:pointer; border-left:5px solid #ffc107; transition: 0.2s; }
            .card:hover { background:rgba(255,255,255,0.2); }
            .sig-name { font-weight:bold; font-size:14px; margin-bottom:4px; }
            .sig-data { font-size:12px; color:#ccc; }
        </style>
    </head>
    <body>
        <div id="side">
            <h2>${stnF} → ${stnT}</h2>
            <p>Direction: ${dir} | Signals: ${reportData.length}</p>
            <hr>${listItems}
        </div>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
            var m = L.map('map').setView([${reportData[0]?.lt || 21}, ${reportData[0]?.lg || 81}], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);
            var path = ${JSON.stringify(window.rtis.map(p => [p.lt, p.lg]))};
            var poly = L.polyline(path, {color:'black', weight:3}).addTo(m);
            m.fitBounds(poly.getBounds());
            var sigs = ${JSON.stringify(reportData)};
            sigs.forEach(s => {
                L.circleMarker([s.lt, s.lg], {radius:6, color:'blue', fillOpacity:0.8}).addTo(m).bindPopup("<b>"+s.n+"</b><br>Speed: "+s.s+" Kmph");
            });
        </script>
    </body>
    </html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `WebReport_${stnF}_to_${stnT}.html`;
    link.click();
};
