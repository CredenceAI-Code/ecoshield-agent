// A tiny stand-in for n8n: executes the generated workflow JSON (Code / If / HTTP / Form / file / respond nodes) in Node.
// HTTP nodes are stubs, so tests can simulate good, wrong, garbage and failing AI replies. Used to test the real graph offline.
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function makeEngine(workflow, opts) {
  opts = opts || {};
  // Nodes are named "1) Console form" in n8n; the tests use the plain names, so every name is stripped of its "N) " prefix here.
  const strip = (s) => String(s).replace(/^\d+b?\) /, '');
  const nodes = {}; workflow.nodes.forEach(n => { nodes[strip(n.name)] = n; });
  const connOf = {}; Object.keys(workflow.connections).forEach(k => { connOf[strip(k)] = (workflow.connections[k].main || []).map(port => port.map(c => ({ ...c, node: strip(c.node) }))); });
  const sd = opts.staticData || {};                    // persistent workflow static data ("memory")
  const exprBody = (e) => String(e).replace(/^=\s*\{\{\s*/, '').replace(/\s*\}\}\s*$/, '');
  const evalExpr = (e, ctx) => new Function('$json', '$', 'return (' + exprBody(e) + ');')(ctx.$json, ctx.$);

  async function run(triggerName, json, o) {
    o = o || {};
    const audit = [], httpLog = [];                       // per run: audit lines written, and every body that would have left the laptop
    const last = {}, outputs = {}, steps = [];
    const $ = (raw) => { const name = strip(raw); return { first: () => (last[name] || [{ json: {} }])[0], all: () => last[name] || [], last: () => (last[name] || [{ json: {} }]).slice(-1)[0] }; };
    const queue = [{ node: triggerName, item: { json } }];
    let response = null, guard = 0;
    while (queue.length) {
      if (++guard > 400) throw new Error('loop guard: too many node executions');
      const { node: name, item } = queue.shift(), n = nodes[name];
      steps.push(name);
      let outs = [[]];
      const ctx = { $json: item.json, $ };
      if (n.type === 'n8n-nodes-base.formTrigger' || n.type === 'n8n-nodes-base.webhook') {
        outs = [[item]];
      } else if (n.type === 'n8n-nodes-base.code') {
        const fn = new AsyncFunction('$json', '$', '$getWorkflowStaticData', 'Buffer', n.parameters.jsCode);
        const self = { helpers: { prepareBinaryData: async (buf, fileName, mime) => ({ data: buf.toString('base64'), fileName, mimeType: mime }) } };
        const res = await fn.call(self, item.json, $, () => sd, Buffer);
        outs = [res];
      } else if (n.type === 'n8n-nodes-base.if') {
        const v = !!evalExpr(n.parameters.conditions.conditions[0].leftValue, ctx);
        outs = v ? [[item], []] : [[], [item]];
      } else if (n.type === 'n8n-nodes-base.httpRequest') {
        const body = JSON.parse(evalExpr(n.parameters.jsonBody, ctx));
        httpLog.push({ node: name, url: n.parameters.url, body });
        const r = o.http ? await o.http(name, body, item.json) : { ok: false, json: { error: 'no stub' } };
        outs = r.ok ? [[{ json: r.json }], []] : [[], [{ json: r.json }]];
      } else if (n.type === 'n8n-nodes-base.form') {
        if (n.parameters.operation === 'completion') { response = { page: evalExpr(n.parameters.responseText, ctx) }; outs = [[]]; }
        else { if (!o.approval) { response = { waitingForApproval: true }; outs = [[]]; } else outs = [[{ json: o.approval(item.json) }]]; }
      } else if (n.type === 'n8n-nodes-base.readWriteFile') {
        audit.push(Buffer.from(item.binary.data.data, 'base64').toString('utf8')); outs = [[item]];
      } else if (n.type === 'n8n-nodes-base.respondToWebhook') {
        response = { page: evalExpr(n.parameters.responseBody, ctx) }; outs = [[]];
      } else throw new Error('engine: unsupported node type ' + n.type + ' (' + name + ')');
      last[name] = outs.flat();
      const conn = connOf[name] || [];
      outs.forEach((arr, idx) => (conn[idx] || []).forEach(c => arr.forEach(it => queue.push({ node: c.node, item: it }))));
    }
    return { steps, last, response, audit: audit.slice(), httpLog: httpLog.slice() };
  }
  return { run, sd };
}
module.exports = { makeEngine };
