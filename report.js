window.saveInteractiveWebReport = function() {
    if(!window.rtis.length) return alert("Generate Map First");
    const sF = document.getElementById('s_from').value, sT = document.getElementById('s_to').value, dir = determineDirection(sF, sT);
    
    let sigData = [];
    window.master.sigs.forEach(sig => {
        if(!sig.type.startsWith(dir)) return;
        let lt = conv(getVal(sig,['Lat'])), lg = conv(getVal(sig,['Lng']));
        let m = window.rtis.find(p => Math.sqrt(Math.pow(p.lt-lt,2)+Math.pow(p.lg-lg,2)) < 0.0015);
        if(m) sigData.push({n:getVal(sig,['SIGNAL_NAME']), s:m.spd, t:m.time, lt:lt, lg:lg, type:sig.type});
    });

    let stnData = [];
    window.master.stns.forEach(s => {
        let n = getVal(s,['Station_Name']), lt = conv(getVal(s,['Start_Lat '])), lg = conv(getVal(s,['Start_Lng']));
        if(window.rtis.some(p => Math.sqrt(Math.pow(p.lt-lt,2)+Math.pow(p.lg-lg,2)) < 0.018)) {
            let a = getStationArea(n);
            stnData.push({n:n, lt:a.lat, lg:a.lng, r:a.radius});
        }
    });

    let html = `<html><head><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><style>
    body{margin:0;display:flex;height:100vh;background:#000;font-family:sans-serif;}
    #side{width:350px;background:#1a1a1a;color:white;padding:15px;overflow-y:auto;}
    #map{flex:1;} .card{background:#333;padding:10px;margin-bottom:8px;border-radius:4px;cursor:pointer;border-left:5px solid #e67e22;}
    .stn-lbl{color:black;font-weight:900;text-shadow:1px 1px white;font-size:12px;}
    </style></head><body><div id="side"><h2>${sF}-${sT}</h2><hr>${sigData.map(r=>`<div class="card" onclick="m.setView([${r.lt},${r.lg}],16)"><b>${r.n}</b><br>Speed: ${r.s} | Time: ${r.t}</div>`).join('')}</div>
    <div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
    var m=L.map('map').setView([${sigData[0].lt},${sigData[0].lg}],13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);
    var path = ${JSON.stringify(window.rtis.map(p=>({lt:p.lt, lg:p.lg, s:p.spd, t:p.time})))};
    var poly=L.polyline(path.map(p=>[p.lt,p.lg]),{color:'yellow',weight:4}).addTo(m);
    m.fitBounds(poly.getBounds());
    
    // Interaction Fix
    poly.on('mousemove', function(e) {
        let pt = path.reduce((a, b) => Math.abs(b.lt-e.latlng.lat) < Math.abs(a.lt-e.latlng.lat) ? b : a);
        L.popup().setLatLng(e.latlng).setContent("Speed: "+pt.s+" Kmph<br>Time: "+pt.t).openOn(m);
    });

    ${JSON.stringify(stnData)}.forEach(a => {
        L.circle([a.lt, a.lg], {radius:a.r, color:'orange', fillOpacity:0.2}).addTo(m);
        L.marker([a.lt, a.lg], {icon:L.divIcon({className:'stn-lbl', html:a.n})}).addTo(m);
    });

    ${JSON.stringify(sigData)}.forEach(s => {
        L.marker([s.lt,s.lg], {icon:L.icon({iconUrl:'master/icons/'+s.type+'.png', iconSize:[22,22]})}).addTo(m).bindPopup(s.n+"<br>Spd: "+s.s+"<br>Time: "+s.t);
    });
    </script></body></html>`;

    let b = new Blob([html],{type:'text/html'}), a = document.createElement('a');
    a.href=URL.createObjectURL(b); a.download=`WebReport_${sF}_to_${sT}.html`; a.click();
};

window.downloadExcelAudit = function() {
    if(!window.rtis.length) return alert("Generate Map First");
    const sF = document.getElementById('s_from').value, sT = document.getElementById('s_to').value, dir = determineDirection(sF, sT);
    let csv = "Type,Signal,Speed,Time\n";
    window.master.sigs.forEach(sig => {
        if(!sig.type.startsWith(dir)) return;
        let lt = conv(getVal(sig,['Lat'])), lg = conv(getVal(sig,['Lng']));
        let m = window.rtis.find(p => Math.sqrt(Math.pow(p.lt-lt,2)+Math.pow(p.lg-lg,2)) < 0.0015);
        if(m) csv += `${sig.type},${getVal(sig,['SIGNAL_NAME'])},${m.spd},${m.time}\n`;
    });
    let b = new Blob([csv],{type:'text/csv'}), a = document.createElement('a');
    a.href=URL.createObjectURL(b); a.download=`Audit_${sF}_to_${sT}.csv`; a.click();
};
