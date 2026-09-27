// GPUの時間を工程ごとに測る（?prof のときだけ）
export class Profiler {
  constructor(gl, enabled) {
    this.gl = gl;
    this.ext = enabled ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
    this.pending = [];
    this.acc = {};
    this.n = 0;
    this.cur = null;
  }
  begin(name) {
    if (!this.ext) return;
    const gl = this.gl;
    if (this.cur) this.end();
    const q = gl.createQuery();
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.cur = { name, q };
  }
  end() {
    if (!this.ext || !this.cur) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.cur);
    this.cur = null;
  }
  frame() {
    if (!this.ext) return;
    this.end();
    const gl = this.gl;
    const still = [];
    for (const p of this.pending) {
      if (gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) {
        const ns = gl.getQueryParameter(p.q, gl.QUERY_RESULT);
        this.acc[p.name] = (this.acc[p.name] || 0) + ns / 1e6;
        gl.deleteQuery(p.q);
        if (p.name === 'final') this.n++;
      } else still.push(p);
    }
    this.pending = still;
  }
  report() {
    const o = {};
    for (const k in this.acc) o[k] = +(this.acc[k] / Math.max(1, this.n)).toFixed(2);
    return o;
  }
}
