/*
This license governs use of the accompanying software ("Software"), and your use of the Software constitutes acceptance of this license.

Subject to the restrictions below, you may use the Software for any commercial or noncommercial purpose, including distributing derivative works.

SECTION 1: DEFINITIONS

A. "Syntactix LLC" refers to Syntactix, LLC, a limited liability corporation organized and operating under the laws of the state of Florida.

B. "Metrix" or "Metrix Library" refers to the Metrix Library WebOS Framework, which is a Syntactix LLC software product.

C. "SOFTWARE" refers to the source code, compiled binaries, installation files documentation and any other materials provided by Syntactix LLC.

SECTION 2: LICENSE

You agree that:

A. Subject to the terms of this license, the Licensor grants you a non-transferable, non-exclusive, worldwide, royalty-free copyright license to reproduce and redistribute unmodified the SOFTWARE for use within your Palm WebOS application provided that the following conditions
are met:

  (i)   All copyright notices are retained.
  (ii)  A copy of this license is retained in the header of each source file of the software.
  
B. You may NOT decompile, disassemble, reverse engineer or otherwise attempt to extract, generate or retrieve source code from any compiled binary provided in the SOFTWARE.

C. You will (a) NOT use Syntactix's name, logo, or trademarks in association with distribution of the SOFTWARE or derivative works unless otherwise permitted in writing; and (b) you WILL indemnify, hold harmless, and defend Syntactix from and against any claims or lawsuits, including attorneys fees, that arise or result from the use or distribution of your modifications to the SOFTWARE and any additional software you distribute along with the SOFTWARE.

D. The SOFTWARE comes "as is", with no warranties. None whatsoever. This means no express, implied or statutory warranty, including without limitation, warranties of merchantability or fitness for a particular purpose or any warranty of title or non-infringement.

E. Neither Syntactix LLC nor its suppliers will be liable for any of those types of damages known as indirect, special, consequential, or incidental related to the SOFTWARE or this license, to the maximum extent the law permits, no matter what legal theory its based on. Also, you must pass this limitation of liability on whenever you distribute the SOFTWARE or derivative works.

F. If you sue anyone over patents that you think may apply to the SOFTWARE for a person's use of the SOFTWARE, your license to the SOFTWARE ends automatically.

G. The patent rights, if any, granted in this license only apply to the SOFTWARE, not to any derivative works you make.

H. The SOFTWARE is subject to U.S. export jurisdiction at the time it is licensed to you, and it may be subject to additional export or import laws in other places.  You agree to comply with all such laws and regulations that may apply to the SOFTWARE after delivery of the SOFTWARE to you.

I. If you are an agency of the U.S. Government, (i) the SOFTWARE is provided pursuant to a solicitation issued on or after December 1, 1995, is provided with the commercial license rights set forth in this license, and (ii) the SOFTWARE is provided pursuant to a solicitation issued prior to December 1, 1995, is provided with Restricted Rights as set forth in FAR, 48 C.F.R. 52.227-14 (June 1987) or DFAR, 48 C.F.R. 252.227-7013 (Oct 1988), as applicable.

J. Your rights under this license end automatically if you breach it in any way.

K. This license contains the only rights associated with the SOFTWARE and Syntactix LLC reserves all rights not expressly granted to you in this license.

� 2010 Syntactix, LLC. All rights reserved.
*/

var Metrix = Class.create(
{
  initialize: function(verificationOverride)
  {        
    this.cookieName = Mojo.appInfo.id + ".metrix";
    this.cookieLoaderName = Mojo.appInfo.id + ".loadMetrix";
    this.cookiePathName = "MetrixFilePath";
          
    this.ServiceRequest = new ServiceRequestWrapper();
    this.AjaxRequest = new AjaxRequestWrapper();

		//init core delay counters
		this.postDeviceDataDelayCount = 0;
		this.customCountsDelayCount = 0;
		this.checkBulletinBoardDelayCount = 0;
		this.isExpiredDelayCount = 0;

    this.initializePathCookie();
    this.initializeLoaderCookie();
    
    if(this.corePastPatchId)
    {
      this.ServiceRequest.request('palm://com.palm.downloadmanager/',{
                                                                         method: 'deleteDownloadedFile',
                                                                         parameters: {"ticket" :  this.corePastPatchId},
                                                                         onSuccess : function (resp)
                                                                         {
                                                                            this.corePastPatchId = null;
                                                                            this.storePathCookie();
                                                                         }.bind(this),
                                                                         onFailure : function (e){ Mojo.Log.info(Object.toJSON(e));}
                                                                     });
                                                                                                                                          
    }
    
    if(!verificationOverride && this.corePath != (Mojo.appPath + "app/models/metrixCore.js") && this.lastCoreVerification > (Date.parse(new Date()) - 14400) )
    {
		    this.AjaxRequest.request("http://metrix.webosroundup.com/MetrixInterface.asmx/GetMetrixCoreCRC",{
		    																					method: "get",
								  																evalJSON: "false",						  																
								  																parameters: {metrixCoreVersion: this.metrixVersion},
								  																onSuccess: function(response)
									                                           {									                                              
									                                              this.cloudCRC = response.responseXML.getElementsByTagName("crc").item(0).textContent;
									                                              
									                                              this.AjaxRequest.request(this.corePath,{
																																				  																method: "get",
																																				  																evalJSON: "false",						  																
																																				  																onSuccess: function(response)
																																					                                           {																																					                                              
																																					                                              var fileCRC = this.crc32(response.responseText);
																																					                                              
																																					                                              if(fileCRC == this.cloudCRC)
																																					                                              {
																																					                                                Mojo.loadScriptWithCallback(this.corePath,function(){this.coreInit();}.bind(this));
																																					                                                this.lastCoreVerification = Date.parse(new Date());
																																					                                              }	
																																					                                              																																				                                              
																																					                                           }.bind(this),
																																				  																onFailure: function(response){return;}
																																				  															});
									                                              
									                                           }.bind(this),
								  																onFailure: function(response){return;}
								  															});
		    	
		    	
		    	
		    
		}
		else
		{
			Mojo.loadScriptWithCallback(this.corePath,function(){this.coreInit();}.bind(this));
		}
    
    var upgradeCheck = this.ServiceRequest.request('palm://com.palm.systemservice/time', {
                                                    method: 'getSystemTime',
                                                    parameters: {},
                                                    onSuccess: this.upgradeTimeCheck.bind(this),
                                                    onFailure: function(){return;}
                                                  });
                                                  
    
  },  
  upgradeTimeCheck: function(response)
  {
    var timeUTC = response.utc;

    if(response.utc > (this.lastUpgradeCheckTime + 86400))
    {
      var url = "http://metrix.webosroundup.com/MetrixInterface.asmx/GetMetrixCoreVersion";
      var checkUpgradeAvailable = this.AjaxRequest.request(url, {
                                                                  method: "get",
                                                                  evalJSON: "false",
                                                                  onSuccess: this.checkUpgradeAvailableSuccess.bind(this, timeUTC),
                                                                  onFailure: this.checkUpgradeAvailableFailure.bind(this),
                                                                  on0: this.checkUpgradeAvailableFailure.bind(this)
                                                                });
    }
  },
  checkUpgradeAvailableSuccess: function(timeUTC, transport)
  {
    this.cloudVersion = transport.responseText.substring(87,transport.responseText.length - 9);
    
    this.lastUpgradeCheckTime = timeUTC;
    this.storeLoaderCookie();
    
    if(this.cloudVersion !== this.metrixVersion)
    {
      this.ServiceRequest.request('palm://com.palm.downloadmanager/', {
                                                                 method: 'download',
                                                                 parameters: {
                                                                   target: "http://metrix.webosroundup.com/Download/metrixCore.js",
                                                                   "targetDir" : "/media/internal/.app-storage/Metrix/source",
                                                                   "targetFilename" : "metrixCore_" + this.cloudVersion.replace(/./g,"_") + ".js",
                                                                   keepFilenameOnRedirect: false,
                                                                   subscribe: true
                                                                 },
                                                                 onSuccess: this.upgradeComplete.bind(this),
                                                                 onFailure: this.upgradeFailed
                                                              });
    }
  },
  checkUpgradeAvailableFailure: function(transport)
  {
  },
  upgradeComplete: function(response)
  {
    if(!response.completed)
    {
      //do nothing
    }
    else
    {    	
    	this.metrixVersion = this.cloudVersion;     	
      this.corePastPatchId = this.coreCurrentPatchId;
      this.coreCurrentPatchId = response.ticket;
      this.corePath = response.target;
      
      this.AjaxRequest.request(this.corePath,function(repsonse)
                                             {
                                                this.crcCheck = this.crc32(response.responseText);
                                                
                                                this.storePathCookie();
                                                this.storeLoaderCookie();
                                                
                                             }.bind(this),function(){return;});      
            
         
    }
  },
  upgradeFailed: function(response)
  {
  },
  initializePathCookie: function()
  {
    this.cookiePathData = new Mojo.Model.Cookie(this.cookiePathName);
    
    var metrixPathCookie = this.cookiePathData.get();
    
    if(metrixPathCookie)
    {
      this.corePath = metrixPathCookie.corePath;
      this.corePastPatchId = metrixPathCookie.corePastPatchId;
      this.coreCurrentPatchId = metrixPathCookie.coreCurrentPatchId;
      this.metrixVersion = metrixPathCookie.metrixVersion;
      this.lastCoreVerification = metrixPathCookie.lastCoreVerification;
    }
    else
    {
      this.corePath = Mojo.appPath + "app/models/metrixCore.js";
      this.metrixVersion = "0.3.2";
      this.coreCurrentPatchId = null;
      this.corePastPatchId = null;
      this.lastCoreVerification = 1254355200;
    }  
  },
  initializeLoaderCookie: function()
  {
    this.cookieLoaderData = new Mojo.Model.Cookie(this.cookieLoaderName);

    var oldMetrixLoadCookie = this.cookieLoaderData.get();

    if(oldMetrixLoadCookie)
    {      
      if(oldMetrixLoadCookie.metrixVersion === this.metrixVersion)
      {                       
        this.lastUpgradeCheckTime = oldMetrixLoadCookie.lastUpgradeCheckTime;
      }
      else
      {
        this.lastUpgradeCheckTime = oldMetrixLoadCookie.lastUpgradeCheckTime;
      }
    }
    else
    {      
      this.lastUpgradeCheckTime = 0;
    }

    this.storeLoaderCookie();
  },
  storePathCookie: function()
  {
    this.cookiePathData.put({
                              corePath: this.corePath,
                              coreCurrentPatchId: this.coreCurrentPatchId,
    												  corePastPatchId: this.corePastPatchId,
                              metrixVersion: this.metrixVersion,
                              crcCheck: this.crcCheck
                            }
                           );
  },
  storeLoaderCookie: function()
  {    
    this.cookieLoaderData.put({    												    
    												    metrixVersion: this.metrixVersion,    												    
    												    lastUpgradeCheckTime: this.lastUpgradeCheckTime
  											      }
  										       );
  },
  crc32: function crc32 ( str ) 
  {
    // Calculate the crc32 polynomial of a string  
    // 
    // version: 1008.1718
    // discuss at: http://phpjs.org/functions/crc32
    // +   original by: Webtoolkit.info (http://www.webtoolkit.info/)
    // +   improved by: T0bsn
    // -    depends on: utf8_encode
    // *     example 1: crc32('Kevin van Zonneveld');
    // *     returns 1: 1249991249
    str = unescape( encodeURIComponent( str )); //this.utf8_encode(str);
    var table = "00000000 77073096 EE0E612C 990951BA 076DC419 706AF48F E963A535 9E6495A3 0EDB8832 79DCB8A4 E0D5E91E 97D2D988 09B64C2B 7EB17CBD E7B82D07 90BF1D91 1DB71064 6AB020F2 F3B97148 84BE41DE 1ADAD47D 6DDDE4EB F4D4B551 83D385C7 136C9856 646BA8C0 FD62F97A 8A65C9EC 14015C4F 63066CD9 FA0F3D63 8D080DF5 3B6E20C8 4C69105E D56041E4 A2677172 3C03E4D1 4B04D447 D20D85FD A50AB56B 35B5A8FA 42B2986C DBBBC9D6 ACBCF940 32D86CE3 45DF5C75 DCD60DCF ABD13D59 26D930AC 51DE003A C8D75180 BFD06116 21B4F4B5 56B3C423 CFBA9599 B8BDA50F 2802B89E 5F058808 C60CD9B2 B10BE924 2F6F7C87 58684C11 C1611DAB B6662D3D 76DC4190 01DB7106 98D220BC EFD5102A 71B18589 06B6B51F 9FBFE4A5 E8B8D433 7807C9A2 0F00F934 9609A88E E10E9818 7F6A0DBB 086D3D2D 91646C97 E6635C01 6B6B51F4 1C6C6162 856530D8 F262004E 6C0695ED 1B01A57B 8208F4C1 F50FC457 65B0D9C6 12B7E950 8BBEB8EA FCB9887C 62DD1DDF 15DA2D49 8CD37CF3 FBD44C65 4DB26158 3AB551CE A3BC0074 D4BB30E2 4ADFA541 3DD895D7 A4D1C46D D3D6F4FB 4369E96A 346ED9FC AD678846 DA60B8D0 44042D73 33031DE5 AA0A4C5F DD0D7CC9 5005713C 270241AA BE0B1010 C90C2086 5768B525 206F85B3 B966D409 CE61E49F 5EDEF90E 29D9C998 B0D09822 C7D7A8B4 59B33D17 2EB40D81 B7BD5C3B C0BA6CAD EDB88320 9ABFB3B6 03B6E20C 74B1D29A EAD54739 9DD277AF 04DB2615 73DC1683 E3630B12 94643B84 0D6D6A3E 7A6A5AA8 E40ECF0B 9309FF9D 0A00AE27 7D079EB1 F00F9344 8708A3D2 1E01F268 6906C2FE F762575D 806567CB 196C3671 6E6B06E7 FED41B76 89D32BE0 10DA7A5A 67DD4ACC F9B9DF6F 8EBEEFF9 17B7BE43 60B08ED5 D6D6A3E8 A1D1937E 38D8C2C4 4FDFF252 D1BB67F1 A6BC5767 3FB506DD 48B2364B D80D2BDA AF0A1B4C 36034AF6 41047A60 DF60EFC3 A867DF55 316E8EEF 4669BE79 CB61B38C BC66831A 256FD2A0 5268E236 CC0C7795 BB0B4703 220216B9 5505262F C5BA3BBE B2BD0B28 2BB45A92 5CB36A04 C2D7FFA7 B5D0CF31 2CD99E8B 5BDEAE1D 9B64C2B0 EC63F226 756AA39C 026D930A 9C0906A9 EB0E363F 72076785 05005713 95BF4A82 E2B87A14 7BB12BAE 0CB61B38 92D28E9B E5D5BE0D 7CDCEFB7 0BDBDF21 86D3D2D4 F1D4E242 68DDB3F8 1FDA836E 81BE16CD F6B9265B 6FB077E1 18B74777 88085AE6 FF0F6A70 66063BCA 11010B5C 8F659EFF F862AE69 616BFFD3 166CCF45 A00AE278 D70DD2EE 4E048354 3903B3C2 A7672661 D06016F7 4969474D 3E6E77DB AED16A4A D9D65ADC 40DF0B66 37D83BF0 A9BCAE53 DEBB9EC5 47B2CF7F 30B5FFE9 BDBDF21C CABAC28A 53B39330 24B4A3A6 BAD03605 CDD70693 54DE5729 23D967BF B3667A2E C4614AB8 5D681B02 2A6F2B94 B40BBE37 C30C8EA1 5A05DF1B 2D02EF8D";
 
    var crc = 0;
    var x = 0;
    var y = 0;
 
    crc = crc ^ (-1);
    for (var i = 0, iTop = str.length; i < iTop; i++) {
        y = ( crc ^ str.charCodeAt( i ) ) & 0xFF;
        x = "0x" + table.substr( y * 9, 8 );
        crc = ( crc >>> 8 ) ^ x;
    }
 
    return crc ^ (-1);
  },
  postDeviceData: function(versionCtrl)
  {  	
  	this.postDeviceDataDelayCount++;
  	  	
  	//set callback till we are ready  	
  	if(this.postDeviceDataDelayCount < 13)
  	{
  		this.postDeviceDataWaitCallback = setTimeout(function(){this.postDeviceData(versionCtrl);}.bind(this),5000);  	
  	}
  },
  customCounts: function(valueGroup,valueName,valueData)
  {
  	return -1;
  },
  checkBulletinBoard: function(controller,minBulletinVersion, forceReview, url)
  {
  	this.checkBulletinBoardDelayCount++;
  	
  	//set callback till we are ready
  	if(this.checkBulletinBoardDelayCount < 13)
  	{
  		this.checkBulletinBoardWaitCallback = setTimeout(function(){this.checkBulletinBoard(controller,minBulletinVersion, forceReview, url);}.bind(this),5000);  	
  	}
  },
  isExpired: function(versionCtrl)
  {
  	this.isExpiredDelayCount++;
  	
  	//set callback till we are ready
  	if(this.isExpiredDelayCount < 13)
  	{
  		this.isExpiredWaitCallback = setTimeout(function(){this.isExpired(currentUtcTime, daysAllowed);}.bind(this),5000);  	
  	}
  }
});
