/*
 * Pagina din WebView care rulează CLIP cu onnxruntime-web (WebAssembly).
 * De ce WebView: motorul nativ ONNX Runtime cădea pe procesoarele noi (Android 17), în cod C++ specific
 * procesorului. WebAssembly rulează în motorul Chrome/Safari al telefonului, într-un proces separat,
 * fără cod scris pentru un procesor anume. Dacă totuși cade, cade doar pagina, nu aplicația.
 *
 * Poza vine ca data URL (deja micșorată), modelul și fișierul .wasm se citesc de pe telefon.
 */
export function clipPageHtml(ortJs: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body>
<script>${ortJs.replace(/<\/script/gi, '<\\/script')}</script>
<script>
(function () {
  var MEAN = [0.48145466, 0.4578275, 0.40821073], STD = [0.26862954, 0.26130258, 0.27577711];
  var session = null, loading = null;
  function post(m) {
    var s = JSON.stringify(m);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.__onClip) window.__onClip(s);
  }
  function load(url) {
    return new Promise(function (res, rej) {
      var x = new XMLHttpRequest();
      x.open('GET', url);
      x.responseType = 'arraybuffer';
      x.onload = function () { (x.status === 0 || x.status === 200) && x.response && x.response.byteLength ? res(x.response) : rej(new Error('nu pot citi ' + url + ' (' + x.status + ')')); };
      x.onerror = function () { rej(new Error('nu pot citi ' + url)); };
      x.send();
    });
  }
  function init(modelUrl, wasmUrl) {
    if (session) return Promise.resolve(session);
    if (loading) return loading;
    loading = load(wasmUrl).then(function (wasm) {
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      ort.env.wasm.wasmBinary = wasm;
      return load(modelUrl);
    }).then(function (model) {
      return ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ['wasm'], graphOptimizationLevel: 'basic' });
    }).then(function (s) { session = s; return s; }, function (e) { loading = null; throw e; });
    return loading;
  }
  function pixels(dataUrl) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () {
        var side = Math.min(img.width, img.height);
        var c = document.createElement('canvas');
        c.width = 224; c.height = 224;
        var g = c.getContext('2d');
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 224, 224);
        var d = g.getImageData(0, 0, 224, 224).data, n = 224 * 224, out = new Float32Array(3 * n);
        for (var i = 0; i < n; i++) {
          out[i] = (d[i * 4] / 255 - MEAN[0]) / STD[0];
          out[n + i] = (d[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
          out[2 * n + i] = (d[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
        }
        res(out);
      };
      img.onerror = function () { rej(new Error('nu pot citi poza')); };
      img.src = dataUrl;
    });
  }
  window.clipEmbed = function (id, modelUrl, wasmUrl, dataUrl) {
    var t0 = Date.now();
    init(modelUrl, wasmUrl).then(function (s) {
      return pixels(dataUrl).then(function (px) {
        return s.run({ pixel_values: new ort.Tensor('float32', px, [1, 3, 224, 224]) });
      });
    }).then(function (out) {
      post({ id: id, emb: Array.prototype.slice.call(out.image_embeds.data), ms: Date.now() - t0 });
    }, function (e) {
      post({ id: id, err: String((e && e.message) || e) });
    });
  };
  post({ ready: true });
})();
</script></body></html>`;
}
