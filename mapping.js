window.master = { stns: [], sigs: [] };
window.rtis = [];
const map = L.map('map').setView([21.15, 79.12], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// 16 DN Sequences & Special UP Logic
const DN_SEQUENCES = [
    ["DURG","DLBS","BQR","BIA","DBEC","DCBIN","ACBIN","KMI","SZB","R","URK","MDH","SLH","BKTHW","BKTHE","TLD","HN","HNEOC","BYT","NPI","DGS","BYL","DPH","BSP"],
    ["TLD MGMT SDG","TLD","HN"], ["HN","HNEOC","HN SM4","HN UCLH SDG","HN MGCH SDG"], ["BYT","NPI","NPI NVCN SDG","NPI PCPN SDG"],
    ["HNEOC","BYT","BYT MRLB SDG"], ["SLH","BKTHW","BKTH MBMB SDG","BKTH CCS SDG"], ["URK","URKE","MDH","MDH MSMM SDG"],
    ["BMY MNBK SDG","BMY P CABIN","DBEC","BMY DNTH YD","DCBIN","ACBIN"],
    ["BMY FMYD","BMY CLYD","BMY CEYD","BMY P CABIN","DBEC","BMY DNTH YD","DCBIN","ACBIN"],
    ["BIA JCWS","BIA JBH","BIA","BLEY EX YARD","DBEC","BMY DNTH YD"],
    ["AAGH","KETI","BPTP","GUDM","DRZ","KYS","BXA","LBO","GDZ","RSA","MXA","ORE YARD"],
    ["DURG","DLBS","MXA","BMY CLYD","BMY CEYD","BMY FMYD"], ["DRZ RSDG SDG","DRZ KSDG SDG","DRZ"],
    ["SZB","R","RVH","RSD"], ["RSD","URKE","MDH"],
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

// Logic: Route Sequence -> Longitude Fallback
function determineDirection(from, to) {
    for(let seq of SPECIAL_UP) if(seq.includes(from) && seq.includes(to) && seq.indexOf(from) < seq.indexOf(to)) return "UP";
    for(let seq of DN_SEQUENCES) if(seq.includes(from) && seq.includes(to)) return seq.indexOf(from) < seq.indexOf(to) ? "DN" : "UP";
    let sF = window.master.stns.find(s => getVal(s,['Station_Name']) === from), sT = window.master.stns.find(s => getVal(s,['Station_Name']) === to);
    if(sF && sT) return conv(getVal(sT,['Start_Lng'])) > conv(getVal(sF,['Start_Lng'])) ? "DN" : "UP";
    return "UNKNOWN";
}

// Logic: Find Station Zone using Outermost Home Signals
function getStationArea(stnName) {
    // Search in all signal lists for "STN_NAME" + "HOME"
    let homes = window.master.sigs.filter(s => {
        let name = getVal(s, ['SIGNAL_NAME']) || "";
        return name.includes(stnName) && name.includes("HOME");
    });

    if (homes.length > 0) {
        let lats = homes.map(s => conv(getVal(s,['Lat'])));
        let lngs = homes.map(s => conv(getVal(s,['Lng'])));
        let minLat = Math.min(...lats), maxLat = Math.max(...lats);
        let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
        let center = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
        
        // Calculate radius to cover the furthest Home signal + 200m buffer
        let maxDist = 0;
        homes.forEach(s => {
            let d = Math.sqrt(Math.pow(conv(getVal(s,['Lat'])) - center[0], 2) + Math.pow(conv(getVal(s,['Lng'])) - center[1], 2)) * 111000;
            if (d > maxDist) maxDist = d;
        });
        return { lat: center[0], lng: center[1], radius: Math.max(maxDist + 200, 600) };
    }
    
    // Final Fallback: station.csv coordinates
    let s = window.master.stns.find(x => getVal(x,['Station_Name']) === stnName);
    return s ? { lat: conv(getVal(s,['Start_Lat '])), lng: conv(getVal(s,['Start_Lng'])), radius: 800 } : null;
}

window.onload = function() {
    Papa.parse("master/station.csv", {download:true, header:true, complete: r => {
        window.master.stns = r.data.filter(s => getVal(s, ['Station_Name']));
        let opt = window.master.stns.map(s => `<option value="${getVal(s,['Station_Name'])}">${getVal(s,['Station_Name'])}</option>`).sort().join('');
        document.getElementById('s_from').innerHTML = opt; document.getElementById('s_to').innerHTML = opt;
    }});
    
    const sigFiles = [
        {f:'master/up_signals.csv', t:'UP', c:'#2ecc71'}, {f:'master/dn_signals.csv', t:'DN', c:'#3498db'},
        {f:'master/up_mid_signals.csv', t:'UP_MID', c:'#e74c3c'}, {f:'master/dn_mid_signals.csv', t:'DN_MID', c:'#9b59b6'}
    ];
    sigFiles.forEach(cfg => {
        Papa.parse(cfg.f, {download:true, header:true, complete: r => {
            r.data.forEach(s => { if(getVal(s, ['Lat'])){ s.clr = cfg.c; s.type = cfg.t; window.master.sigs.push(s); } });
        }});
    });
};

function generateLiveMap() {
    const f = document.getElementById('csv_file').files[0];
    const stnF = document.getElementById('s_from').value;
    const stnT = document.getElementById('s_to').value;
    if(!f) return alert("RTIS File select karein!");

    const dir = determineDirection(stnF, stnT);

    Papa.parse(f, {header:true, skipEmptyLines:true, complete: function(res) {
        let areaF = getStationArea(stnF), areaT = getStationArea(stnT);
        let rawData = res.data.map(row => ({
            lt: parseFloat(getVal(row,['Latitude','Lat'])), lg: parseFloat(getVal(row,['Longitude','Lng'])),
            spd: parseFloat(getVal(row,['Speed','Spd'])) || 0, raw: row
        })).filter(p => !isNaN(p.lt));

        // Logic: Slice data between From Station and To Station
        let startIdx = rawData.findIndex(p => Math.sqrt(Math.pow(p.lt-areaF.lat,2)+Math.pow(p.lg-areaF.lng,2)) < 0.009);
        let endIdx = rawData.findLastIndex(p => Math.sqrt(Math.pow(p.lt-areaT.lat,2)+Math.pow(p.lg-areaT.lng,2)) < 0.009);
        window.rtis = (startIdx !== -1 && endIdx !== -1) ? rawData.slice(startIdx, endIdx + 1) : rawData;

        map.eachLayer(l => { if(l instanceof L.Circle || l instanceof L.Marker || l instanceof L.Polyline) map.removeLayer(l); });

        // Logic: Draw Orange Zones with Bold Labels
        [stnF, stnT].forEach(name => {
            let a = getStationArea(name);
            if(a) {
                L.circle([a.lat, a.lng], {radius: a.radius, color: 'orange', fillOpacity: 0.25, weight: 2}).addTo(map);
                L.marker([a.lat, a.lng], {
                    icon: L.divIcon({className:'stn-label', html: `<span style="color:black; font-weight:900; font-size:15px; text-transform:uppercase;">${name} STN</span>`, iconSize:[120,20]})
                }).addTo(map);
            }
        });

        // Logic: Plot Railway Signal Icons
        window.master.sigs.forEach(sig => {
            if(!sig.type.startsWith(dir)) return;
            let sLt = conv(getVal(sig,['Lat'])), sLg = conv(getVal(sig,['Lng']));
            let match = window.rtis.filter(p => Math.sqrt(Math.pow(p.lt-sLt,2)+Math.pow(p.lg-sLg,2)) < 0.002);
            
            if(match.length > 0) {
                match.sort((a,b) => Math.sqrt(Math.pow(a.lt-sLt,2)+Math.pow(a.lg-sLg,2)) - Math.sqrt(Math.pow(b.lt-sLt,2)+Math.pow(b.lg-sLg,2)));
                
                let sigIcon = L.divIcon({
                    className: 'sig-icon',
                    html: `<div style="display:flex; flex-direction:column; align-items:center;">
                             <div style="background:${sig.clr}; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow: 1px 1px 3px rgba(0,0,0,0.5);"></div>
                             <div style="background:#333; width:2px; height:12px;"></div>
                             <div style="background:#333; width:8px; height:2px;"></div>
                           </div>`,
                    iconSize: [12, 26]
                });
                
                L.marker([sLt, sLg], {icon: sigIcon}).addTo(map)
                .on('mouseover', () => { 
                    document.getElementById('live-speed').innerText = match[0].spd.toFixed(1);
                    document.getElementById('live-time').innerText = getVal(match[0].raw, ['Time','Logging Time']) || "--:--";
                })
                .bindPopup(`<b>${getVal(sig,['SIGNAL_NAME'])}</b><br>Crossing Speed: ${match[0].spd} Kmph`);
            }
        });

        let path = window.rtis.map(p => [p.lt, p.lg]);
        L.polyline(path, {color: '#222', weight: 4, opacity: 0.8}).addTo(map);
        if(path.length > 0) map.fitBounds(path);
        document.getElementById('log').innerText = `Path: ${stnF} to ${stnT} (${dir})`;
    }});
}
