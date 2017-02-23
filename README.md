# BetterX-Firefox
The BetterX-Firefox extension monitors and records web metrics on all android firefox activity in json formatted log files. The metrics are based on a modified/anonymous version of the [HAR Specification](http://www.softwareishard.com/blog/har-12-spec/).

## [Live Environment](https://github.com/eliasall/BetterX-Firefox/tree/master/live-environment)
Contains the extension used in the live data collection phase of the [BetterX.org](http://www.betterx.org) research project.

*File Structure* (UID_mmddyyyy_filename.json)
* UID (Android Device ID)
* Month Day Year (Daily generated)
* Filename
  * tabs (tracks firefox tab activity)
  * info (firefox version and domains)
  * web (anonymous http traces for all requests)

## [Lab Environment](https://github.com/eliasall/BetterX-Firefox/tree/master/lab-environment)
Contains addons that were used for a user web experience lab study of the [BetterX.org](http://www.betterx.org) research project.
* AutoScroller _Automatic scrolling of web pages using device orientation_
* BetterXfy* _CSS Injection and different hacks on amazon.co.uk_

### Referencing
Usage of any parts of this software or data requires referencing in any published or publicised work. The correct referencing is presented below in Harvard, MLA8 and APA styles.
 
Harvard

`Allayiotis, E. (2017) BetterX System. N.A: BetterX.org.`
 
MLA8

`Allayiotis, Elias. “BetterX System.” 23 Feb. 2017, www.betterx.org.`
 
APA

`Allayiotis, E. (2017). BetterX System (Version 1.2). [Application software]. Retrieved from <http://www.betterx.org/>`

### License
Anyone interested in this project can download/modify/contribute to the source code that is made available.   The BetterX project is licenced under the Apache License, Version 2.0

_Copyright 2017 Elias Allayiotis_

_Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0_

_Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License._
