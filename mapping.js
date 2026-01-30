window.master = { stns: [], sigs: [] };
window.rtis = [];
const map = L.map('map').setView([21.15, 79.12], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

const DN_SEQUENCES = [
    ["DURG","DLBS","BQR","BIA","DBEC","DCBIN","ACBIN","KMI","SZB","R","URK","MDH","SLH","BKTHW","BKTHE","TLD","HN","HNEOC","BYT","NPI","DGS","BYL","DPH","BSP"],
    ["TLD MGMT SDG","TLD","HN"], ["HN","HNEOC","HN SM4","HN UCLH SDG","HN MGCH SDG"],
    ["BYT","NPI","NPI NVCN SDG","NPI PCPN SDG"], ["HNEOC","BYT","BYT MRLB SDG"],
    ["SLH","BKTHW","BKTH MBMB SDG","BKTH CCS SDG"], ["URK","URKE","MDH","MDH MSMM SDG"],
    ["BMY MNBK SDG","BMY P CABIN","DBEC","BMY DNTH YD","DCBIN","ACBIN"],
    ["BMY FMYD","BMY CLYD","BMY CEYD","BMY P CABIN","DBEC","BMY DNTH YD","DCBIN","ACBIN"],
    ["BIA JCWS","BIA JBH","BIA","BLEY EX YARD","DBEC","BMY DNTH YD"],
    ["AAGH","KETI","BPTP","GUDM","DRZ","KYS","BXA","LBO","GDZ","RSA","MXA","ORE YARD"],
    ["DURG","DLBS","MXA","BMY CLYD","BMY CEYD","BMY FMYD"], ["DRZ RSDG SDG","DRZ KSDG SDG","DRZ"],
    ["SZB","R","RVH","RSD"], ["RSD","URKE","MDH"],
    ["TIG","RNBT","MRBL","KBJ","TRKR","HSK","LKNA","NPD","KRAR","KMK","BGBR","BMKJ","ARN","MSMD","BLSN","ANMD","LAE","NRMH","MNDH","RVH","R","RSD"]
];
const SPECIAL_UP = [["RSD","URKW","R","SZB"], ["RSD","R","SZB"]];

function conv(v) { if(!v) return null; let n = parseFloat(v.toString().replace(/[^0-9.]/g, '')); return Math.floor(n/100) + ((n%100)/60); }
function getVal(row, keys) { if(!row) return null; let foundKey = Object.keys(row).find(k => keys.some(key => k.trim().toLowerCase() === key.toLowerCase().trim())); return foundKey ? row[foundKey] : null; }

function determineDirection(f, t) {
    for(let s of SPECIAL_UP) if(s.includes(f) && s.includes(t) && s.indexOf(f) < s.indexOf(t)) return "UP";
    for(let s of DN_SEQUENCES) if(s.includes(f) && s.includes(t)) return s.indexOf(f) < s.indexOf(t) ? "DN" : "UP";
    return "DN";
}

window.onload = function() {
    Papa.parse("master/station.csv", {download:true, header:true, complete: r => {
        window.master.stns = r.data.filter(s => getVal(s, ['Station_Name']));
        let h = window.master.stns.map(s => `<option value="${getVal(s,['Station_Name'])}">${getVal(s,['Station_Name'])}</option>`).sort().join('');
        document.getElementById('s_from').innerHTML = h; document.getElementById('s_to').innerHTML = h;
    }});
    const files = [{f:'up_signals.csv', t:'UP', c:'#2ecc71'}, {f:'dn_signals.csv', t:'DN', c:'#3498db'}, {f:'up_mid_signals.csv', t:'UP_MID', c:'#e74c3c'}, {f:'dn_mid_signals.csv', t:'DN_MID', c:'#9b59b6'}];
    files.forEach(c => { Papa.parse("master/"+c.f, {download:true, header:true, complete: r => { r.data.forEach(s => { if(getVal(s,['Lat'])){ s.type=c.t; s.clr=c.c; window.master.sigs.push(s); } }); }}); });
};

function generateLiveMap() {
    const f = document.getElementById('csv_file').files[0];
    const sF = document.getElementById('s_from').value, sT = document.getElementById('s_to').value;
    if(!f) return alert("Select File");
    const dir = determineDirection(sF, sT);

    Papa.parse(f, {header:true, skipEmptyLines:true, complete: function(res) {
        let raw = res.data.map(r => ({ lt: parseFloat(getVal(r,['Lat','Latitude'])), lg: parseFloat(getVal(r,['Lng','Longitude'])), spd: parseFloat(getVal(r,['Spd','Speed']))||0, time: getVal(r,['Time','Logging Time'])||"-", raw: r })).filter(p => !isNaN(p.lt));
        
        // Find Start/End based on station coordinates
        let stnStart = window.master.stns.find(x => getVal(x,['Station_Name']) === sF);
        let stnEnd = window.master.stns.find(x => getVal(x,['Station_Name']) === sT);
        let si = raw.findIndex(p => Math.sqrt(Math.pow(p.lt-conv(getVal(stnStart,['Start_Lat '])),2)+Math.pow(p.lg-conv(getVal(stnStart,['Start_Lng'])),2)) < 0.015);
        let ei = raw.findLastIndex(p => Math.sqrt(Math.pow(p.lt-conv(getVal(stnEnd,['Start_Lat '])),2)+Math.pow(p.lg-conv(getVal(stnEnd,['Start_Lng'])),2)) < 0.015);
        window.rtis = (si!==-1 && ei!==-1) ? raw.slice(si, ei+1) : raw;

        map.eachLayer(l => { if(l instanceof L.CircleMarker || l instanceof L.Marker || l instanceof L.Polyline) map.removeLayer(l); });

        // Plot Stations (No Circle, Just Label)
        window.master.stns.forEach(s => {
            let n = getVal(s,['Station_Name']), lt = conv(getVal(s,['Start_Lat '])), lg = conv(getVal(s,['Start_Lng']));
            if(window.rtis.some(p => Math.sqrt(Math.pow(p.lt-lt,2)+Math.pow(p.lg-lg,2)) < 0.012)) {
                L.marker([lt, lg], {icon: L.divIcon({className:'', html: `<b style="color:black; font-size:12px; text-shadow:1px 1px white;">${n}</b>`})}).addTo(map);
            }
        });

        // Plot Signal Dots
        window.master.sigs.forEach(sig => {
            if(!sig.type.startsWith(dir)) return;
            let slt = conv(getVal(sig,['Lat'])), slg = conv(getVal(sig,['Lng']));
            let m = window.rtis.find(p => Math.sqrt(Math.pow(p.lt-slt,2)+Math.pow(p.lg-slg,2)) < 0.0012);
            if(m) {
                L.circleMarker([slt, slg], {radius: 6, color: sig.clr, fillOpacity: 0.9, fillColor: 'white', weight: 2})
                .addTo(map).bindPopup(`<b>${getVal(sig,['SIGNAL_NAME'])}</b><br>Speed: ${m.spd} | Time: ${m.time}`);
            }
        });

        let poly = L.polyline(window.rtis.map(p=>[p.lt,p.lg]), {color: 'black', weight: 3}).addTo(map);
        poly.on('mousemove', e => {
            let p = window.rtis.reduce((a, b) => Math.abs(b.lt-e.latlng.lat) < Math.abs(a.lt-e.latlng.lat) ? b : a);
            document.getElementById('live-speed').innerText = p.spd;
            document.getElementById('live-time').innerText = p.time;
        });
        map.fitBounds(poly.getBounds());
    }});
}
