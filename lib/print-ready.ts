/**
 * Script for a print popup: prints once every image and font has loaded. Printing from the body's
 * onload fires before the photos have downloaded, which printed blank pages.
 */
export const PRINT_WHEN_READY = `<script>
(function () {
    var imgs = Array.prototype.slice.call(document.images);
    var loaded = imgs.map(function (img) {
        return img.complete ? Promise.resolve() : new Promise(function (done) { img.onload = img.onerror = done; });
    });
    var fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    Promise.all(loaded.concat([fonts])).then(function () {
        return Promise.all(imgs.map(function (img) { return img.decode ? img.decode().catch(function () {}) : null; }));
    }).then(function () {
        setTimeout(function () { window.print(); setTimeout(function () { window.close(); }, 1000); }, 250);
    });
})();
</script>`;
