// Writes the synthetic dataset for judges: smart_resource_meters.csv (all 10 scenarios) and scenarios.csv. Deterministic.
const fs = require('fs'), path = require('path');
const C = require('./core.js');
const outDir = path.join(__dirname, 'data'); fs.mkdirSync(outDir, { recursive: true });
const head = 'scenario_id,day,hour,weekday_index,water_lph,kwh,occupied,outdoor_c,setpoint_c,water_b_lph';
const lines = [head];
C.ALL_SCENARIOS.forEach(s => C.genScenario(s).forEach(r => lines.push([s.id, r.day, r.hour, r.dow, r.water_lph === null ? '' : r.water_lph, r.kwh === null ? '' : r.kwh, r.occupied, r.outdoor_c, r.setpoint_c, r.water_b_lph === undefined || r.water_b_lph === null ? '' : r.water_b_lph].join(','))));
fs.writeFileSync(path.join(outDir, 'smart_resource_meters.csv'), lines.join('\n') + '\n');
const q = (t) => '"' + String(t).replace(/"/g, '""') + '"';
const sc = ['scenario_id,name,description,request_type,expected_leak_verdict,expected_guard_rule'];
C.ALL_SCENARIOS.forEach(s => sc.push([s.id, q(s.name), q(s.desc), s.request.type, s.expect.leak, s.expect.rule].join(',')));
fs.writeFileSync(path.join(outDir, 'scenarios.csv'), sc.join('\n') + '\n');
console.log('rows:', lines.length - 1, '->', path.join(outDir, 'smart_resource_meters.csv'));
