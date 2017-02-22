//	www.betterX.org
//	elias allayiotis

const {Cu} = require("chrome");
const {TextEncoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {});
// Get Android ID for file name
//var AndroidID = "123456789";
var AndroidID = require("./Android_id.js").GetAndroidID();
var curDate = require("./Date.js");

function SaveLogDataWeb(data, path)
{
	// Generate file path/name
	var filePath = path + "/" + AndroidID + "_web_" + curDate.GetFormatedDate();
		
	OS.File.open(filePath, {write: true, append: false}).then(hFile => {
		
		OS.File.stat(filePath).then(fileInfo => {
			var timestamp = new Date().getTime();
			var txtToAppend;
			
			if (fileInfo.size == 0) {	
				// first write to file, create root json object
				txtToAppend = "{\"pages\": [";
				// append session object
				txtToAppend = txtToAppend + data;
				txtToAppend = txtToAppend + "]}";
				
				// write to file
				var txtEncoded = new TextEncoder().encode(txtToAppend);
				hFile.write(txtEncoded).then(valWrite => {
					hFile.close();
				});
			} else {
				// Not first write to file, set file pointer to the end of last element in "pages[]"
				hFile.setPosition(-2, OS.File.POS_END).then(function() {
					// append session object
					txtToAppend = ",";
					txtToAppend = txtToAppend + data;
					txtToAppend = txtToAppend + "]}";
					
					var txtEncoded = new TextEncoder().encode(txtToAppend);
					hFile.write(txtEncoded).then(valWrite => {
						hFile.close();
					});
				});
			}
		});
	});
}

exports.SaveLogDataWeb = SaveLogDataWeb;
