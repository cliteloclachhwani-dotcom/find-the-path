window.master = { stns: [], sigs: [] };
window.rtis = [];
const map = L.map('map').setView([21.15, 79.12], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Aapke dwara bataye gaye 16 DN Sequences
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

// Coordinate conversion logic (DDMM.MMMM to DD.DDDD)
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

// Logic B: Direction Determination (Sequence based)
function determineDirection(from, to) {
    for(let seq of SPECIAL_UP) {
        if(seq.includes(from) && seq.includes(to) && seq.indexOf(from) < seq.indexOf(to)) return "UP";
    }
    for(let seq of DN_SEQUENCES) {
        if(seq.includes(from) && seq.includes(to)) {
            return seq.indexOf(from) < seq.indexOf(to) ? "DN" : "UP";
        }
    }
    let sF = window.master.stns.find(s => getVal(s,['Station_Name']) === from);
    let sT = window.master.stns.find(s => getVal(s,['Station_Name']) === to);
    if(sF && sT) {
        return conv(getVal(sT,['Start_Lng'])) > conv(getVal(sF,['Start_Lng'])) ? "DN" : "UP";
    }
    return "UNKNOWN";
}

// Logic A: Station Orange Zone (Outermost Home Signals)
function getStationArea(stnName) {
    let homes = window.master.sigs.filter(s => {
        let name = getVal(s, ['SIGNAL_NAME']) || "";
        return name.includes(stnName) && name.includes("HOME");
    });

    if(homes.length > 0) {
        let lats = homes.map(s => conv(getVal(s,['Lat'])));
        let lngs = homes.map(s => conv(getVal(s,['Lng'])));
        let minLat = Math.min(...lats), maxLat = Math.max(...lats);
        let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
        // Radius calculation to cover all homes
        let dist = Math.sqrt(Math.pow(maxLat-minLat,2) + Math.pow(maxLng-minLng,2)) * 111000;
        return { lat: (minLat + maxLat)/2, lng: (minLng + maxLng)/2, radius: Math.max(dist/2 + 200, 500) }; 
    }
    let s = window.master.stns.find(x => getVal(x,['Station_Name']) === stnName);
    return s ? { lat: conv(getVal(s,['Start_Lat '])), lng: conv(getVal(s,['Start_Lng'])), radius: 800 } : null;
}

// File Loading from 'master/' folder
window.onload = function() {
    Papa.parse("master/station.csv", {download:true, header:true, complete: r => {
        window.master.stns = r.data.filter(s => getVal(s, ['Station_Name']));
        let opt = window.master.stns.map(s => '<option value="'+getVal(s,['Station_Name'])+'">'+getVal(s,['Station_Name'])+'</option>').sort().join('');
        document.getElementById('s_from').innerHTML = opt; 
        document.getElementById('s_to').innerHTML = opt;
    }});
    
    const sigFiles = [
        {f:'master/up_signals.csv', t:'UP', c:'green'}, 
        {f:'master/dn_signals.csv', t:'DN', c:'blue'}, 
        {f:'master/up_mid_signals.csv', t:'UP_MID', c:'red'}, 
        {f:'master/dn_mid_signals.csv', t:'DN_MID', c:'purple'}
    ];
    
    sigFiles.forEach(cfg => {
        Papa.parse(cfg.f, {download:true, header:true, complete: r => {
            r.data.forEach(s => { 
                if(getVal(s, ['Lat'])){ 
                    s.clr = cfg.c; 
                    s.type = cfg.t; 
                    window.master.sigs.push(s); 
                } 
            });
        }});
    });
};

function generateLiveMap() {
    const f = document.getElementById('csv_file').files[0];
    const stnF = document.getElementById('s_from').value;
    const stnT = document.getElementById('s_to').value;
    const dir = determineDirection(stnF, stnT);

    if(!f) return alert("Please select RTIS file");

    Papa.parse(f, {header:true, skipEmptyLines:true, complete: function(res) {
        let areaF = getStationArea(stnF), areaT = getStationArea(stnT);
        let rawData = [];
        res.data.forEach(row => {
            let lt = parseFloat(getVal(row,['Latitude','Lat'])), lg = parseFloat(getVal(row,['Longitude','Lng']));
            if(!isNaN(lt)) rawData.push({lt, lg, spd: parseFloat(getVal(row,['Speed','Spd']))||0, raw: row});
        });

        // Logic C: Slice RTIS Data between From/To Station Zones
        let startIndex = rawData.findIndex(p => Math.sqrt(Math.pow(p.lt-areaF.lat,2)+Math.pow(p.lg-areaF.lng,2)) < 0.01);
        let endIndex = rawData.findIndex((p, i) => i > startIndex && Math.sqrt(Math.pow(p.lt-areaT.lat,2)+Math.pow(p.lg-areaT.lng,2)) < 0.01);
        window.rtis = (startIndex !== -1 && endIndex !== -1) ? rawData.slice(startIndex, endIndex + 1) : rawData;

        map.eachLayer(l => { if(!!l.toGeoJSON) map.removeLayer(l); });

        // Draw Orange Station Zones
        [stnF, stnT].forEach(name => {
            let a = getStationArea(name);
            if(a) {
                L.circle([a.lat, a.lng], {radius: a.radius, color: 'orange', fillOpacity: 0.3, weight: 2}).addTo(map);
                L.marker([a.lat, a.lng], {icon: L.divIcon({className:'stn-label', html: `<b>${name} STN</b>`, iconSize: [100,20]})}).addTo(map);
            }
        });

        // Plot filtered Signals and match with RTIS
        window.master.sigs.forEach(sig => {
            if(!sig.type.startsWith(dir)) return;
            let sLt = conv(getVal(sig,['Lat'])), sLg = conv(getVal(sig,['Lng']));
            
            let match = window.rtis.filter(p => Math.sqrt(Math.pow(p.lt-sLt,2)+Math.pow(p.lg-sLg,2)) < 0.002);
            if(match.length > 0) {
                match.sort((a,b) => Math.sqrt(Math.pow(a.lt-sLt,2)+Math.pow(a.lg-sLg,2)) - Math.sqrt(Math.pow(b.lt-sLt,2)+Math.pow(b.lg-sLg,2)));
                let spd = match[0].spd;
                
                // Signal Icon logic
                let icon = L.divIcon({html: `<div style="background:${sig.clr}; width:14px; height:14px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 5px #000;"></div>`, className: ''});
                L.marker([sLt, sLg], {icon: icon}).addTo(map)
                .on('mouseover', () => { 
                    document.getElementById('live-speed').innerText = spd.toFixed(1);
                    document.getElementById('live-time').innerText = getVal(match[0].raw, ['Time','Logging Time']) || "--:--";
                })
                .bindPopup(`<b>${getVal(sig,['SIGNAL_NAME'])}</b><br>Speed: ${spd} Kmph`);
            }
        });

        let path = window.rtis.map(p => [p.lt, p.lg]);
        if(path.length > 0) {
            L.polyline(path, {color: '#333', weight: 4, opacity: 0.7}).addTo(map);
            map.fitBounds(path);
        }
        document.getElementById('log').innerText = `Status: ${stnF} to ${stnT} (${dir}) - ${window.rtis.length} points sliced.`;
    }});
}
