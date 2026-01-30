window.downloadExcelAudit = function() {
    if(!window.rtis.length) return alert("Pehle Map generate karein!");
    const stnF = document.getElementById('s_from').value, stnT = document.getElementById('s_to').value, dir = determineDirection(stnF, stnT);
    let csv = `Audit: ${stnF} to ${stnT} (${dir})\nSignal Type,Signal Name,Crossing Speed,Crossing Time\n`;
    window.master.sigs.forEach(sig => {
        if(!sig.type.startsWith(dir)) return;
        let match = window.rtis.find(p => Math.sqrt(Math.pow(p.lt-conv(getVal(sig,['Lat'])),2)+Math.pow(p.lg-conv(getVal(sig,['Lng'])),2)) < 0.002);
        if(match) csv += `${sig.type},${getVal(sig,['SIGNAL_NAME'])},${match.spd},${match.time}\n`;
    });
    let b = new Blob([csv], {type:'text/csv'}), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = `Audit_${stnF}_to_${stnT}.csv`; a.click();
};

window.saveInteractiveWebReport = function() {
    const stnF = document.getElementById('s_from').value, stnT = document.getElementById('s_to').value, dir = determineDirection(stnF, stnT);
    let reportData = [];
    window.master.sigs.forEach(sig => {
        if(!sig.type.startsWith(dir)) return;
        let match = window.rtis.find(p => Math.sqrt(Math.pow(p.lt-conv(getVal(sig,['Lat'])),2)+Math.pow(p.lg-conv(getVal(sig,['Lng'])),2)) < 0.002);
        if(match) reportData.push({n:getVal(sig,['SIGNAL_NAME']), s:match.spd, t:match.time, lt:conv(getVal(sig,['Lat'])), lg:conv(getVal(sig,['Lng'])), type:sig.type});
    });

    let stnAreas = [];
    window.master.stns.forEach(stn => {
        let name = getVal(stn, ['Station_Name']), sLt = conv(getVal(stn,['Start_Lat '])), sLg = conv(getVal(stn,['Start_Lng']));
        if(window.rtis.some(p => Math.sqrt(Math.pow(p.lt-sLt,2)+Math.pow(p.lg-sLg,2)) < 0.015)) {
            let a = getStationArea(name);
            stnAreas.push({name: name, lat: a.lat, lng: a.lng, rad: a.radius});
        }
    });

    let html = `<html><head><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><style>body{margin:0;display:flex;height:100vh;background:#000;font-family:sans-serif;}#side{width:360px;background:#1a1a1a;color:white;padding:15px;overflow-y:auto;}#map{flex:1;}.card{background:#2a2a2a;padding:12px;margin-bottom:10px;border-radius:5px;cursor:pointer;border-left:6px solid #e67e22;}.stn-text{color:black;font-weight:900;text-shadow:1px 1px white;}</style></head><body>
    <div id="side"><h2>${stnF} &#8594; ${stnT}</h2><p>Direction: ${dir}</p><hr>${reportData.map(r=>`<div class="card" onclick="m.setView([${r.lt},${r.lg}],16)"><b>${r.n}</b><br><small>Speed: ${r.s} | Time: ${r.t}</small></div>`).join('')}</div>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
    var m=L.map('map').setView([${reportData[0].lt},${reportData[0].lg}],13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);
    var rtisData = ${JSON.stringify(window.rtis.map(p=>({lt:p.lt, lg:p.lg, spd:p.spd, time:p.time})))};
    var poly=L.polyline(rtisData.map(p=>[p.lt,p.lg]),{color:'yellow',weight:4}).addTo(m);
    m.fitBounds(poly.getBounds());
    
    // Interactive Path Hover in Web Report
    poly.on('mousemove', function(e) {
        let pt = rtisData.reduce((prev, curr) => Math.abs(curr.lt-e.latlng.lat) < Math.abs(prev.lt-e.latlng.lat) ? curr : prev);
        L.popup().setLatLng(e.latlng).setContent("<b>Speed: "+pt.spd+" Kmph</b><br>Time: "+pt.time).openOn(m);
    });

    ${JSON.stringify(stnAreas)}.forEach(a => {
        L.circle([a.lat, a.lng], {radius: a.rad, color: 'orange', fillOpacity: 0.2}).addTo(m);
        L.marker([a.lat, a.lng], {icon: L.divIcon({html:'<b class="stn-text">'+a.name+'</b>', className:''})}).addTo(m);
    });

    ${JSON.stringify(reportData)}.forEach(s => {
        L.circleMarker([s.lt,s.lg],{color:'cyan',radius:7}).addTo(m).bindPopup(s.n+"<br>Speed: "+s.s+"<br>Time: "+s.t);
    });
    </script></body></html>`;
    
    let blob = new Blob([html], {type:'text/html'}), link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = `WebReport_${stnF}_to_${stnT}.html`; link.click();
};
