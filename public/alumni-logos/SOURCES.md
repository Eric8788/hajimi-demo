# Alumni Logo Source Inventory

These files are stored as real school logo assets for the Hajimi alumni map.

- `official/`: downloaded source files used by the app. These are not redrawn or AI-generated.
- `raw/`: earlier source-download archive kept for traceability.
- `display/`: display-only PNG derivatives generated from files in `official/`.
  These are cropped/trimmed and resized for small map pins; they are not
  original source files and should not be presented as originals.

The app keeps original `logoUrl` files in `official/` and uses `mapLogoUrl`
files in `display/` for small alumni-map pins.

## Schools

| App key | School | App asset | Source type | Source URL / note |
|---|---|---|---|---|
| `ucsd` | UC San Diego | `official/ucsd-seal.svg` | Wikimedia Commons source file | `https://commons.wikimedia.org/wiki/Special:FilePath/Seal_of_the_University_of_California,_San_Diego.svg` |
| `duke` | Duke University | `official/duke-university-seal.png` | Wikimedia Commons source file | `https://commons.wikimedia.org/wiki/Special:FilePath/Duke_University_Seal.png` |
| `uiuc` | University of Illinois Urbana-Champaign | `official/uiuc-university-seal.svg` | Wikimedia Commons source file | `https://commons.wikimedia.org/wiki/Special:FilePath/University_of_Illinois_seal.svg` |
| `uiuc-block-i-archive` | University of Illinois Urbana-Champaign | `official/uiuc-block-i.png` | Wikimedia Commons source file, archived old mark | `https://commons.wikimedia.org/wiki/Special:FilePath/Illinois_Block_I.png` |
| `uw-seattle` | University of Washington | `official/uw-seattle-seal.svg` | Wikipedia/Wikimedia source file | `https://upload.wikimedia.org/wikipedia/en/5/58/University_of_Washington_seal.svg` |
| `uw-seattle-block-w-archive` | University of Washington | `official/uw-seattle-block-w.svg` | Wikimedia Commons source file, archived old mark | `https://commons.wikimedia.org/wiki/Special:FilePath/University_of_Washington_Block_W_logo_RGB_brand_colors.svg` |
| `unc-chapel-hill` | UNC-Chapel Hill | `official/unc-seal.jpg` | Wikimedia Commons source file | `https://commons.wikimedia.org/wiki/Special:FilePath/UNC_Seal.JPG` |
| `unc-primary-mark-archive` | UNC-Chapel Hill | `official/unc-primary-mark-blue.svg` | Wikimedia Commons source file, archived old mark | `https://commons.wikimedia.org/wiki/Special:FilePath/UNC_primary_mark_blue.svg` |
| `pcp` | Philadelphia College of Pharmacy / Saint Joseph's University | `official/pcp-sju-crest.jpg` | Official Saint Joseph's University design standards image | `https://www.sju.edu/offices/marcomm/design-standards` lists `BS---04---Crest.jpg`. |
| `uc-davis` | UC Davis | `official/uc-davis-seal.svg` | Wikimedia Commons source file | `https://commons.wikimedia.org/wiki/Special:FilePath/The_University_of_California_Davis.svg` |
| `usc` | University of Southern California | `official/usc-seal.svg` | Wikimedia Commons source file | `https://commons.wikimedia.org/wiki/Special:FilePath/University_of_Southern_California_(USC)_seal.svg` |
| `usc-interlocking-archive` | University of Southern California | `official/usc-interlocking-sc.svg` | Wikimedia Commons source file, archived old mark | `https://commons.wikimedia.org/wiki/Special:FilePath/USC_Trojans_logo.svg` |
| `northeastern` | Northeastern University | `official/northeastern-seal.png` | Wikimedia Commons source file | `https://commons.wikimedia.org/wiki/Special:FilePath/NU_RGB_seal_R.png` |
| `ubc` | University of British Columbia | `official/ubc-coat-of-arms.svg` | Wikimedia Commons source file | `https://commons.wikimedia.org/wiki/Special:FilePath/UBC_COA2.svg` |
| `ic` | Imperial College London | `official/imperial-college-london-crest.png` | Wikimedia Commons source file | `https://commons.wikimedia.org/wiki/Special:FilePath/Imperial_College_London-CREST.png` |
| `ucl` | UCL | `official/ucl-logo.png` | Wikimedia Commons source file | `https://commons.wikimedia.org/wiki/Special:FilePath/Ucl_logo.png` |
| `cardiff` | Cardiff University | `official/cardiff-university-logo.svg` | Wikimedia Commons source file | `https://commons.wikimedia.org/wiki/Special:FilePath/Cardiff_University_(logo).svg` |
| `oxford` | University of Oxford | `official/oxford-coat-of-arms.svg` | Wikimedia Commons source file | `https://commons.wikimedia.org/wiki/Special:FilePath/Coat_of_arms_of_the_University_of_Oxford.svg` |
| `kcl` | King's College London | `official/kcl-red-box-logo.jpg` | Wikimedia Commons source file | `https://commons.wikimedia.org/wiki/Special:FilePath/King%27s_logo_-_white_text_in_red_box.jpg` |
| `hku` | The University of Hong Kong | `official/hku-shield-logo.jpg` | Official HKU website image | `https://www.hku.hk/assets/img/hku-shield-logo.jpg` |
| `hku-full` | The University of Hong Kong | `official/hku-115.svg` | Official HKU website logo | `https://www.hku.hk/assets/img/hku-115.svg` |
| `usyd` | University of Sydney | `official/usyd-logo-dark.svg` | Official University of Sydney website logo | `https://www.sydney.edu.au/content/dam/icons/logos/logo-usyd-dark.svg` |

## Display Derivatives

Each file below is generated from the corresponding `official/` source by
trimming transparent/white padding, resizing the real mark to fit a 220px box,
and exporting as a 256px PNG for small map pins. The `unc-seal-pin.png`,
`pcp-sju-crest-pin.png`, and `hku-shield-logo-pin.png` files use manual crops
from their official source images to remove large surrounding photo/page space.

| Display asset | Derived from official source |
|---|---|
| `display/ucsd-seal-pin.png` | `official/ucsd-seal.svg` |
| `display/duke-university-seal-pin.png` | `official/duke-university-seal.png` |
| `display/uiuc-university-seal-pin.png` | `official/uiuc-university-seal.svg` |
| `display/uw-seattle-seal-pin.png` | `official/uw-seattle-seal.svg` |
| `display/unc-seal-pin.png` | `official/unc-seal.jpg` |
| `display/pcp-sju-crest-pin.png` | `official/pcp-sju-crest.jpg` |
| `display/uc-davis-seal-pin.png` | `official/uc-davis-seal.svg` |
| `display/usc-seal-pin.png` | `official/usc-seal.svg` |
| `display/northeastern-seal-pin.png` | `official/northeastern-seal.png` |
| `display/ubc-coat-of-arms-pin.png` | `official/ubc-coat-of-arms.svg` |
| `display/imperial-college-london-crest-pin.png` | `official/imperial-college-london-crest.png` |
| `display/ucl-logo-pin.png` | `official/ucl-logo.png` |
| `display/cardiff-university-logo-pin.png` | `official/cardiff-university-logo.svg` |
| `display/oxford-coat-of-arms-pin.png` | `official/oxford-coat-of-arms.svg` |
| `display/kcl-red-box-logo-pin.png` | `official/kcl-red-box-logo.jpg` |
| `display/hku-shield-logo-pin.png` | `official/hku-shield-logo.jpg` |
| `display/usyd-logo-dark-pin.png` | `official/usyd-logo-dark.svg` |

## File Checksums

```text
bc72d7c2f6a0094932cbc1af242aa9c086448a0d8bdd85f0374d6cee4f00712b  official/cardiff-university-logo.svg
347a32dff1867dbbfd7cbf2825bb82f9aef770c5fe1c20acbb87805cfbcca840  official/duke-university-seal.png
112944fc5797fc911b55645ce50647404f4732af9223e48c4863021da348601f  official/hku-115.svg
5e51832ffcec94a253c9a3507f887257235c4ee05e12194d25dfef89c3f09ba1  official/hku-shield-logo.jpg
8bc9b549fb87b7c6d363ddea7f45273d7060bdbae2619b6492d38defd9217f54  official/imperial-college-london-crest.png
0882b3eeae7ad0f1d758c8c944d3327bf48d44e1812901a441f50f5cf4b92ea1  official/kcl-red-box-logo.jpg
1e53d204a93b04b80804d0c821b44b98c77155549eea7ea538b382c73ba50877  official/northeastern-seal.png
1a8fde72b0c23796abdaba2a42802ee19bb8e61d29819aaec95ed8846d9d079c  official/oxford-coat-of-arms.svg
d4abe797c660b7fa6e0434ccfecba121c76fdcdd388ea56f5b1ca99ed0280fb6  official/pcp-sju-crest.jpg
22cc26ea84b8c8817a15651b8dcaa092b4ff3f7ec2cb937ffe23251223aaeea8  official/ubc-coat-of-arms.svg
f576368ab1edf7e4b933638e1029e7f44fb26420af6e95143baeaa7e554a5b85  official/uc-davis-seal.svg
41a14903533763e75204f2b0407b839dd8df30c9b1a3f913b6620cc7c792555e  official/ucl-logo.png
141afd195a701da920aa0534e1f13bc7e30bead527ee33c78d99c8e2ef603dde  official/ucsd-seal.svg
d41ad5c0c92fad76d1dc0f1f4a598b17e1d6e7b155975dff871cd21034f37670  official/uiuc-block-i.png
e962e1598768bc38925462a6ab78d6a6cd99fcc14f7846464bee03411cd51a88  official/uiuc-university-seal.svg
727158c7833f29713612e0cf501b0c79cad1d8769063a844d47896d844ad0f70  official/unc-primary-mark-blue.svg
33536af119ba87d12b82851f24b30d913dbf9d00a248bfda0b2630d986b66cea  official/unc-seal.jpg
59f43cdefd1ac852546bc196c5de6ba91a97ed5354e85952230cf73aab472bfa  official/usc-interlocking-sc.svg
ab3b90951cacc0ad902b6b03770b8c0889f397f44bb9f7898f880b5eebc0ea14  official/usc-seal.svg
09db16c0a2e810e34a6dc553aafd59070e1585704d2f859047712bbf067a6808  official/usyd-logo-dark.svg
8eb7e7934ad64de5ab3a4ef57af33b182b1c878963cb7f4f8160d61567089d7b  official/uw-seattle-block-w.svg
662b0d6bf08cc03cdea956078f9ea50380afa68030ea23284e1769e4a6c3281b  official/uw-seattle-seal.svg
7d406d808582946d44cedad9e3e5c6d73e90de7049dcf63a5d2adc7d32ae982e  display/cardiff-university-logo-pin.png
3fd14f0ba330b16d15bb2796625037591cc7f12d658985e59eeca06c03290bca  display/duke-university-seal-pin.png
09a9d941a345a0829812bdea748c0132d7fdaa3ed0e7964dd2e8d6c558b254f3  display/hku-shield-logo-pin.png
8c5f963cfd5e0a1e5f8de56fd03647e2003b779341b00f90a4dd2c67ca143d4a  display/imperial-college-london-crest-pin.png
3265c9d16feac6481816191c588621cb883a778618e80ba4b4cf44e308dfbfd3  display/kcl-red-box-logo-pin.png
80f31fc573ae479f5db02ee7ae49674bb832c6c1c46e9ee0a1b2919f2ad1327f  display/northeastern-seal-pin.png
7f93392d41dd4bdb1532303d023610214fe4453b0de56040e9080e0921a3f781  display/oxford-coat-of-arms-pin.png
e528a615b2e245efcda61664d1b256e3a7d18d4db04b0e26e71c40c79a1f3b89  display/pcp-sju-crest-pin.png
7b3ce9b33c1ea2cb8741f9fc74f915977fcb44b6e581f79dba8236c9937704d3  display/ubc-coat-of-arms-pin.png
2d406b7ba036dcb8c52e47e45ed8998e42d63791db0732abff49f1164bae52dd  display/uc-davis-seal-pin.png
d25c38b03cb84e73740483c185f3da543be4b203f38aab678bd28a70611cf54a  display/ucl-logo-pin.png
6082adf8692eaface4c83fd593024813c478848e3beca02f4b29c821b2e63937  display/ucsd-seal-pin.png
69262003e83f3fa3df30481b00d8c8645cdcfa563cc02585364d3fc93320e26a  display/uiuc-university-seal-pin.png
8dc59e9d4b8637c9d6b88dbcba92990ce7328ecf1b22f38cc8b4187ab0886837  display/unc-seal-pin.png
fa726ddca437846876eb56ccd9b450c2e7027fa058de95993d7abd13014b6ae4  display/usc-seal-pin.png
1f0274b191003829136573e1600dbfdcc87b713f6b08c46f94ec480c8aa8225c  display/usyd-logo-dark-pin.png
382ceaf099c844d26fc94249c89736acedfb06d20313e6d9085771b06e8464d3  display/uw-seattle-seal-pin.png
```
