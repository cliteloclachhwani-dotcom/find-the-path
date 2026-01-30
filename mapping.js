window.master = { stns: [], sigs: [] };
window.rtis = [];
const map = L.map('map').setView([21.15, 79.12], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// FULL 16 DN SEQUENCES - No Shortcuts
const DN_SEQUENCES = [
    ["DURG","DLBS","BQR","BIA","DBEC","DCBIN","ACBIN","KMI","SZB","R","URK","MDH","SLH","BKTHW","BKTHE","TLD","HN","HNEOC","BYT","NPI","DGS","BYL","DPH","BSP"],
    ["TLD MGMT SDG","TLD","HN"],
    ["HN","HNEOC","HN SM4","HN UCLH SDG","HN MGCH SDG"],
    ["BYT","NPI","NPI NVCN SDG","NPI PCPN SDG"],
    ["HNEOC","BYT","BYT MRLB SDG"],
    ["SLH","BKTHW","BKTH MBMB SDG","BKTH CCS SDG"],
    ["URK","URKE","MDH","MDH MSMM SDG"],
    ["BMY MNBK SDG","BMY P CABIN","DBEC","BMY DNTH YD","DCBIN","ACBIN"],
    ["BMY FMYD","BMY CLYD","BMY CEYD","BMY P CABIN","DBEC","BMY DNTH YD","DCBIN","ACBIN"],
    ["BIA JCWS","BIA JBH","BIA","BLEY EX YARD","DBEC","BMY DNTH YD"],
    ["AAGH","KETI","BPTP","GUDM","DRZ","KYS","BXA","LBO","GDZ","RSA","MXA","ORE YARD"],
    ["DURG","DLBS","MXA","BMY CLYD","BMY CEYD","BMY FMYD"],
    ["DRZ RSDG SDG","DRZ KSDG SDG","DRZ"],
    ["SZB","R","RVH","RSD"],
    ["RSD","URKE","MDH"],
    ["TIG","RNBT","MRBL","KBJ","TRKR","HSK","LKNA","NPD","KRAR","KMK","BGBR","BMKJ","ARN","MSMD","BLSN","ANMD","LAE","NRMH","MNDH","RVH","R","RSD"]
];
const SPECIAL_UP = [["RSD","URKW","R","SZB"], ["RSD","R","SZB"]];

function conv(v) { 
    if(!v) return null; 
    let n = parseFloat(v.toString().replace(/[^0-9.]/g, '')); 
    return Math.floor(n/100) + ((n%100)/60); 
}

function getVal(row, keys) { 
    if(!row) return null; 
    let foundKey = Object.keys(row).find(k => keys.some(key => k.trim().toLowerCase() === key.toLowerCase().trim())); 
    return foundKey ? row[foundKey] : null; 
}

function determineDirection(from, to) {
    for(let seq of SPECIAL_UP) if(seq.includes(from) && seq.includes(to) && seq.indexOf(from) < seq.indexOf(to)) return "UP";
    for(let seq of DN_SEQUENCES) if(seq.includes(from) && seq.includes(to)) return seq.indexOf(from) < seq.indexOf(to) ? "DN" : "UP";
    return "DN"; 
}

function getStationArea(stnName) {
    // Search all signals for this station's HOME signals to define boundary
    let homes = window.master.sigs.filter(s => {
        let name = (getVal(s, ['SIGNAL_NAME']) || "").toUpperCase();
        return name.includes(stnName.toUpperCase()) && name.includes("HOME");
    });

    if (homes.length > 0) {
        let lats = homes.map(s => conv(getVal(s,['Lat'])));
        let lngs = homes.map(s => conv(getVal(s,['Lng'])));
        let center = [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
        let maxDist = 0;
        homes.forEach(s => {
            let d = Math.sqrt(Math.pow(conv(getVal(s,['Lat']))-center[0], 2) + Math.pow(conv(getVal(s,['Lng']))-center[1], 2)) * 111000;
            if (d > maxDist) maxDist = d;
        });
        return { lat: center[0], lng: center[1], radius: maxDist + 250 };
    }
    // Fallback to station.csv coordinates
    let s = window.master.stns.find(x => getVal(x,['Station_Name']) === stnName);
    return s ? { lat: conv(getVal(s,['Start_Lat '])), lng: conv(getVal(s,['Start_Lng'])), radius: 800 } : null;
}

window.onload = function() {
    Papa.parse("master/station.csv", {download:true, header:true, complete: r => {
        window.master.stns = r.data.filter(s => getVal(s, ['Station_Name']));
        let opt = window.master.stns.map(s => `<option value="${getVal(s,['Station_Name'])}">${getVal(s,['Station_Name'])}</option>`).sort().join('');
        document.getElementById('s_from').innerHTML = opt; document.getElementById('s_to').innerHTML = opt;
    }});
    const sigFiles = [{f:'master/up_signals.csv', t:'UP'}, {f:'master/dn_signals.csv', t:'DN'}, {f:'master/up_mid_signals.csv', t:'UP_MID'}, {f:'master/dn_mid_signals.csv', t:'DN_MID'}];
    sigFiles.forEach(cfg => { Papa.parse(cfg.f, {download:true, header:true, complete: r => { r.data.forEach(s => { if(getVal(s, ['Lat'])){ s.type = cfg.t; window.master.sigs.push(s); } }); }}); });
};

function generateLiveMap() {
    const file = document.getElementById('csv_file').files[0];
    const stnFrom = document.getElementById('s_from').value;
    const stnTo = document.getElementById('s_to').value;
    if(!file) return alert("RTIS File select karein!");
    const dir = determineDirection(stnFrom, stnTo);

    Papa.parse(file, {header:true, skipEmptyLines:true, complete: function(res) {
        let fullData = res.data.map(row => ({
            lt: parseFloat(getVal(row,['Latitude','Lat'])),
            lg: parseFloat(getVal(row,['Longitude','Lng'])),
            spd: parseFloat(getVal(row,['Speed','Spd'])) || 0,
            time: getVal(row,['Time','Logging Time']) || "--:--:--",
            raw: row
        })).filter(p => !isNaN(p.lt));

        let areaF = getStationArea(stnFrom), areaT = getStationArea(stnTo);
        let startIdx = fullData.findIndex(p => Math.sqrt(Math.pow(p.lt-areaF.lat,2)+Math.pow(p.lg-areaF.lng,2)) < 0.015);
        let endIdx = fullData.findLastIndex(p => Math.sqrt(Math.pow(p.lt-areaT.lat,2)+Math.pow(p.lg-areaT.lng,2)) < 0.015);
        window.rtis = (startIdx !== -1 && endIdx !== -1) ? fullData.slice(startIdx, endIdx + 1) : fullData;

        map.eachLayer(l => { if(l instanceof L.Circle || l instanceof L.Marker || l instanceof L.Polyline) map.removeLayer(l); });

        // LOGIC: Plot ALL Stations in the RTIS path
        window.master.stns.forEach(stn => {
            let name = getVal(stn, ['Station_Name']);
            let sLt = conv(getVal(stn,['Start_Lat '])), sLg = conv(getVal(stn,['Start_Lng']));
            // Check if train passed through this station's vicinity
            if(window.rtis.some(p => Math.sqrt(Math.pow(p.lt-sLt,2)+Math.pow(p.lg-sLg,2)) < 0.015)) {
                let a = getStationArea(name);
                L.circle([a.lat, a.lng], {radius: a.radius, color: 'orange', fillOpacity: 0.25, weight: 2}).addTo(map);
                L.marker([a.lat, a.lng], {icon: L.divIcon({className:'stn-label', html:`<b class="stn-text">${name} STN</b>`, iconAnchor: [50, 0]})}).addTo(map);
            }
        });

        // LOGIC: Plot Signals with PNG Icons from folder
        window.master.sigs.forEach(sig => {
            if(!sig.type.startsWith(dir)) return;
            let sLt = conv(getVal(sig,['Lat'])), sLg = conv(getVal(sig,['Lng']));
            let match = window.rtis.find(p => Math.sqrt(Math.pow(p.lt-sLt,2)+Math.pow(p.lg-sLg,2)) < 0.002);
            if(match) {
                let sigIcon = L.icon({ iconUrl: `master/icons/${sig.type}.png`, iconSize: [26, 26], iconAnchor: [13, 13] });
                L.marker([sLt, sLg], {icon: sigIcon}).addTo(map).bindPopup(`<b>${getVal(sig,['SIGNAL_NAME'])}</b><br>Speed: ${match.spd} Kmph<br>Time: ${match.time}`);
            }
        });

        // INTERACTIVE PATH
        let poly = L.polyline(window.rtis.map(p=>[p.lt,p.lg]), {color: '#333', weight: 5, opacity: 0.8}).addTo(map);
        poly.on('mousemove', (e) => {
            let pt = window.rtis.reduce((prev, curr) => Math.abs(curr.lt-e.latlng.lat) < Math.abs(prev.lt-e.latlng.lat) ? curr : prev);
            document.getElementById('live-speed').innerText = pt.spd.toFixed(1);
            document.getElementById('live-time').innerText = pt.time;
        });
        map.fitBounds(poly.getBounds());
    }});
}
