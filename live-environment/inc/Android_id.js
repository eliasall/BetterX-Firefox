//	www.betterX.org
//	elias allayiotis

// Get Android ID usind Android API through Java Native Interface
// Based on http://stackoverflow.com/questions/18972495/how-to-get-device-id-with-jni-in-android

const {Cu} = require("chrome");
const myJNI = Cu.import("resource://gre/modules/JNI.jsm", {}).JNI;

var android_id = null;

function GetAndroidID()
{
	if (android_id == null) {
		var myJenv = myJNI.GetForThread();

		var JCSecure = myJNI.LoadClass(myJenv, "android/provider/Settings$Secure", {
		   static_fields: [
			 { name: "ANDROID_ID", sig: "Ljava/lang/String;" }
		   ],
		   static_methods: [
			 { name: "getString", sig: "(Landroid/content/ContentResolver;Ljava/lang/String;)Ljava/lang/String;" }
		   ],
		});

		var geckoAppShell = myJNI.LoadClass(myJenv, "org/mozilla/gecko/GeckoAppShell", {
				static_methods: [
					{ name: "getContext", sig: "()Landroid/content/Context;" }
				],
			});

		myJNI.LoadClass(myJenv, "android/content/Context", {
			methods: [
					{ name: "getContentResolver", sig: "()Landroid/content/ContentResolver;" }
				],
		});

		var JCContext = geckoAppShell.getContext();
		var JCContentResolver = JCContext.getContentResolver();
		var jStrID = JCSecure.getString(JCContentResolver, "android_id");
		android_id = myJNI.ReadString(myJenv, jStrID);
	}
	
	return android_id;
}

exports.GetAndroidID = GetAndroidID;