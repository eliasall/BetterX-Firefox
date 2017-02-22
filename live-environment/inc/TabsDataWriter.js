//	www.betterX.org
//	elias allayiotis

const {Cu} = require("chrome");
// To write content to file
const {TextEncoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {});
// Get Android ID for file name
//var AndroidID = "123456789";
var AndroidID = require("./Android_id.js").GetAndroidID();
var curDate = require("./Date.js");

var m_fileIsLocked = false;

function SaveLogDataTabs(data, path)
{
	//Generate file path/name
	var filePath = path + "/" + AndroidID + "_tabs_" + curDate.GetFormatedDate();
	
	OS.File.open(filePath, {write: true, append: false}).then(hFile => {
		// Get file size after open
		OS.File.stat(filePath).then(fileInfo => {
			var timestamp = new Date().getTime();
			var txtToAppend;
			
			if (fileInfo.size == 0) {	
				// first write to file, create root json object
				txtToAppend = "{\"tabs\": [{";
				txtToAppend = txtToAppend + "\"timestamp\":" +  timestamp + ",";
				txtToAppend = txtToAppend + "\"tabid\": \"" + data.id + "\",";
				txtToAppend = txtToAppend + "\"tabstatus\": \"" + data.action + "\"";
				txtToAppend = txtToAppend + "}]}";
				
				// write to file
				var txtEncoded = new TextEncoder().encode(txtToAppend);
				hFile.write(txtEncoded).then(valWrite => {
					hFile.close();
				});
			} else {
				// Not first write to file, set file pointer to the end of last element in "tabs[]"
				hFile.setPosition(-2, OS.File.POS_END).then(function() {
					// put together json object
					txtToAppend = ",{";
					txtToAppend = txtToAppend + "\"timestamp\":" +  timestamp + ",";
					txtToAppend = txtToAppend + "\"tabid\": \"" + data.id + "\",";
					txtToAppend = txtToAppend + "\"tabstatus\": \"" + data.action + "\"";
					txtToAppend = txtToAppend + "}]}";
					
					var txtEncoded = new TextEncoder().encode(txtToAppend);
					hFile.write(txtEncoded).then(valWrite => {
						hFile.close();
					});
				});
			}
		});
	});
}

function FileLocked() {
	return m_fileIsLocked;
}

exports.SaveLogDataTabs = SaveLogDataTabs;
exports.FileLocked = FileLocked;
