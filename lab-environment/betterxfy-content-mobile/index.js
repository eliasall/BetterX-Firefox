var self = require('sdk/self');
var data = require("sdk/self").data;
var pageMod = require('sdk/page-mod');

pageMod.PageMod({
    include : /.*/,
    contentScriptFile: [data.url("amazon_css.js")]
});