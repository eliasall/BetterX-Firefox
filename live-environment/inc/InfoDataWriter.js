//	www.betterX.org
//	elias allayiotis

const {Cu} = require("chrome");
// To write content to file
const {TextEncoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {});
// To get browser version
var system = require("sdk/system");
// Get Android ID for file name
//var AndroidID = "123456789";
var AndroidID = require("./Android_id.js").GetAndroidID();
var curDate = require("./Date.js");

function SaveLogDataInfo(data, path)
{
	// Generate file path/name
	var filePath = path + "/" + AndroidID + "_info_" + curDate.GetFormatedDate();
	
	// open file
	OS.File.open(filePath, {write: true, append: false}).then(hFile => {		
		var timestamp = new Date().getTime();
		var txtToWrite;
		
		// put together json object
		txtToWrite = "{";
		txtToWrite = txtToWrite + "\"timestamp\":" + timestamp + ",";
		txtToWrite = txtToWrite + "\"version\": \"" + data + "\",";
		txtToWrite = txtToWrite + "\"browser\": \"" + system.version + "\"";
		txtToWrite = txtToWrite + "}";
		
		// write to file
		var txtEncoded = new TextEncoder().encode(txtToWrite);
		hFile.write(txtEncoded).then(valWrite => {
			// always close
			hFile.close();
		});
	});
}

exports.SaveLogDataInfo = SaveLogDataInfo;
