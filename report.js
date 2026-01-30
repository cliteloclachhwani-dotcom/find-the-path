window.saveInteractiveWebReport = function() {
    if(!window.rtis.length) return alert("Pehle Map generate karein");
    const sF = document.getElementById('s_from').value, sT = document.getElementById('s_to').value, dir = determineDirection(sF, sT);
    
    let sigData = [];
    window.master.sigs.forEach(sig => {
        if(!sig.type.startsWith(dir)) return;
        let lt = conv(getVal(sig,['Lat'])), lg = conv(getVal(sig,['Lng']));
        let m = window.rtis.find(p => Math.sqrt(Math.pow(p.lt-lt,2)+Math.pow(p.lg-lg,2)) < 0.0012);
        if(m) sigData.push({n:getVal(sig,['SIGNAL_NAME']), s:m.spd, t:m.time, lt:lt, lg:lg, clr:sig.clr});
    });

    let stnData = [];
    window.master.stns.forEach(s => {
        let n = getVal(s,['Station_Name']), lt = conv(getVal(s,['Start_Lat '])), lg = conv(getVal(s,['Start_Lng']));
        if(window.rtis.some(p => Math.sqrt(Math.pow(p.lt-lt,2)+Math.pow(p.lg-lg,2)) < 0.012)) stnData.push({n:n, lt:lt, lg:lg});
    });

    let html = `<html><head><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><style>
    body{margin:0;display:flex;height:100vh;background:#f4f4f4;font-family:sans-serif;}
    #side{width:350px;background:#fff;padding:15px;overflow-y:auto;border-right:1px solid #ddd;}
    #map{flex:1;} .card{background:#fff;padding:12px;margin-bottom:10px;border-radius:5px;cursor:pointer;border:1px solid #eee;border-left:6px solid;font-weight:bold;}
    </style></head><body><div id="side"><h3>SECR RAIPUR</h3><b>${sF} &#8594; ${sT}</b><hr>${sigData.map(r=>`<div class="card" style="border-left-color:${r.clr}" onclick="m.setView([${r.lt},${r.lg}],17)">${r.n}<br><small>Spd: ${r.s} | Time: ${r.t}</small></div>`).join('')}</div>
    <div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
    var m=L.map('map').setView([${sigData[0].lt},${sigData[0].lg}],15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);
    var rData = ${JSON.stringify(window.rtis.map(p=>({lt:p.lt, lg:p.lg, s:p.spd, t:p.time})))};
    var poly=L.polyline(rData.map(p=>[p.lt,p.lg]),{color:'black',weight:4}).addTo(m);
    m.fitBounds(poly.getBounds());
    
    poly.on('mousemove', function(e) {
        let p = rData.reduce((a, b) => Math.abs(b.lt-e.latlng.lat) < Math.abs(a.lt-e.latlng.lat) ? b : a);
        L.popup().setLatLng(e.latlng).setContent("Speed: "+p.s+" Kmph<br>Time: "+p.t).openOn(m);
    });

    ${JSON.stringify(stnData)}.forEach(a => {
        L.marker([a.lt, a.lg], {icon:L.divIcon({html:'<b style="font-size:12px;color:#000;text-shadow:1px 1px white;">'+a.n+'</b>', className:''})}).addTo(m);
    });

    ${JSON.stringify(sigData)}.forEach(s => {
        L.circleMarker([s.lt,s.lg], {radius:7, color:'white', fillColor:s.clr, fillOpacity:1, weight:1.5}).addTo(m).bindPopup(s.n+"<br>Spd: "+s.s);
    });
    </script></body></html>`;

    let b = new Blob([html],{type:'text/html'}), a = document.createElement('a');
    a.href=URL.createObjectURL(b); a.download=`WebReport.html`; a.click();
};

window.downloadExcelAudit = function() {
    if(!window.rtis.length) return alert("No Data");
    const sF = document.getElementById('s_from').value, sT = document.getElementById('s_to').value, dir = determineDirection(sF, sT);
    let csv = "Type,Signal,Speed,Time\n";
    window.master.sigs.forEach(sig => {
        if(!sig.type.startsWith(dir)) return;
        let lt = conv(getVal(sig,['Lat'])), lg = conv(getVal(sig,['Lng']));
        let m = window.rtis.find(p => Math.sqrt(Math.pow(p.lt-lt,2)+Math.pow(p.lg-lg,2)) < 0.0012);
        if(m) csv += `${sig.type},${getVal(sig,['SIGNAL_NAME'])},${m.spd},${m.time}\n`;
    });
    let b = new Blob([csv],{type:'text/csv'}), a = document.createElement('a');
    a.href=URL.createObjectURL(b); a.download=`Audit_Data.csv`; a.click();
};
