window.downloadExcelAudit = function() {
    if (!window.rtis || window.rtis.length === 0) return alert("Pehle Step 1: Map Generate karein!");
    
    const stnF = document.getElementById('s_from').value;
    const stnT = document.getElementById('s_to').value;
    const dir = determineDirection(stnF, stnT);

    let csv = `Audit Report: ${stnF} to ${stnT} (${dir} Movement)\n`;
    csv += "Type,Signal Name,Crossing Speed (Kmph),Time\n";

    let auditLog = [];
    window.master.sigs.forEach(sig => {
        if (!sig.type.startsWith(dir)) return;
        let sLt = conv(getVal(sig, ['Lat'])), sLg = conv(getVal(sig, ['Lng']));
        let match = window.rtis.filter(p => Math.sqrt(Math.pow(p.lt-sLt,2)+Math.pow(p.lg-sLg,2)) < 0.002);

        if (match.length > 0) {
            match.sort((a,b) => Math.sqrt(Math.pow(a.lt-sLt,2)+Math.pow(a.lg-sLg,2)) - Math.sqrt(Math.pow(b.lt-sLt,2)+Math.pow(b.lg-sLg,2)));
            auditLog.push({
                type: sig.type,
                name: getVal(sig, ['SIGNAL_NAME']),
                spd: match[0].spd.toFixed(1),
                time: getVal(match[0].raw, ['Time', 'Logging Time']) || "N/A",
                idx: window.rtis.indexOf(match[0])
            });
        }
    });

    auditLog.sort((a, b) => a.idx - b.idx).forEach(r => {
        csv += `${r.type},${r.name},${r.spd},${r.time}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Audit_${stnF}_to_${stnT}.csv`;
    a.click();
};

window.saveInteractiveWebReport = function() {
    if (!window.rtis || window.rtis.length === 0) return alert("Pehle Step 1: Map Generate karein!");
    const stnF = document.getElementById('s_from').value;
    const stnT = document.getElementById('s_to').value;
    const dir = determineDirection(stnF, stnT);

    let reportData = [];
    window.master.sigs.forEach(sig => {
        if (!sig.type.startsWith(dir)) return;
        let sLt = conv(getVal(sig, ['Lat'])), sLg = conv(getVal(sig, ['Lng']));
        let match = window.rtis.filter(p => Math.sqrt(Math.pow(p.lt-sLt,2)+Math.pow(p.lg-sLg,2)) < 0.002);
        if (match.length > 0) {
            match.sort((a,b) => Math.sqrt(Math.pow(a.lt-sLt,2)+Math.pow(a.lg-sLg,2)) - Math.sqrt(Math.pow(b.lt-sLt,2)+Math.pow(b.lg-sLg,2)));
            reportData.push({ 
                n: getVal(sig,['SIGNAL_NAME']), 
                s: match[0].spd.toFixed(1), 
                t: getVal(match[0].raw,['Time','Logging Time'])||"N/A", 
                lt: sLt, lg: sLg, 
                clr: sig.clr, 
                type: sig.type,
                idx: window.rtis.indexOf(match[0]) 
            });
        }
    });
    reportData.sort((a, b) => a.idx - b.idx);

    // Sidebar cards with color coding
    let listItems = reportData.map(r => `
        <div class="card" onclick="m.setView([${r.lt}, ${r.lg}], 16)" style="border-left: 6px solid ${r.clr};">
            <div style="font-size:10px; color:${r.clr}; font-weight:bold;">${r.type}</div>
            <div class="sig-name">${r.n}</div>
            <div class="sig-data">Speed: <b style="color:#fff;">${r.s} Kmph</b> | Time: ${r.t}</div>
        </div>
    `).join('');

    let htmlContent = `
    <html>
    <head>
        <title>Report: ${stnF}-${stnT}</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
            body { margin:0; display:flex; font-family:sans-serif; height:100vh; background:#000; }
            #side { width:360px; overflow-y:auto; padding:15px; background:#1a1a1a; color:white; border-right:1px solid #333; }
            #map { flex:1; }
            .card { background:#2a2a2a; padding:10px; margin-bottom:8px; border-radius:4px; cursor:pointer; transition:0.2s; }
            .card:hover { background:#333; }
            .sig-name { font-weight:bold; font-size:13px; margin:3px 0; }
            .sig-data { font-size:11px; color:#aaa; }
            hr { border:0; border-top:1px solid #444; margin:15px 0; }
        </style>
    </head>
    <body>
        <div id="side">
            <h3 style="margin:0; color:#ffc107;">${stnF} &#8594; ${stnT}</h3>
            <p style="font-size:12px; color:#888;">Direction: ${dir} | Sliced Points: ${window.rtis.length}</p>
            <hr>
            ${listItems}
        </div>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
            var m = L.map('map').setView([${reportData[0].lt},${reportData[0].lg}], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);
            
            var pathData = ${JSON.stringify(window.rtis.map(p=>[p.lt,p.lg]))};
            var poly = L.polyline(pathData, {color:'#ffea00', weight:3, opacity:0.6}).addTo(m);
            m.fitBounds(poly.getBounds());

            var signals = ${JSON.stringify(reportData)};
            signals.forEach(s => {
                L.circleMarker([s.lt, s.lg], {radius:7, color:s.clr, fillOpacity:0.9, weight:2, fillColor:'white'}).addTo(m)
                .bindPopup("<b>"+s.n+"</b><br>Speed: "+s.s+" Kmph");
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
