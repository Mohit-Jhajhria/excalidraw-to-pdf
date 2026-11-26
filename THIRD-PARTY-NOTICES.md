# Credits and third-party licenses

Excalidraw to PDF is made by Moita and released under the MIT license (see `LICENSE`).
It is not affiliated with or endorsed by Excalidraw.

The website is built from other people's free software. This page lists what is inside it and under
which license. The same text is published with the website as `third-party-notices.txt`, followed by the
full license texts of React, ReactDOM, pdf-lib and Noto Sans Devanagari.

## Excalidraw (drawing renderer)

`@excalidraw/excalidraw` is used to draw your file exactly as Excalidraw shows it.
Source: https://github.com/excalidraw/excalidraw - MIT license.

```
MIT License

Copyright (c) 2020 Excalidraw

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Libraries

| Library | License | Source |
| --- | --- | --- |
| React and ReactDOM | MIT | https://github.com/facebook/react |
| pdf-lib (builds the PDF file) | MIT | https://github.com/Hopding/pdf-lib |
| The other open-source code that Excalidraw itself is made of | see the license notes kept at the end of `app.js` | https://github.com/excalidraw/excalidraw |

The full text of the React, ReactDOM and pdf-lib licenses is added to `third-party-notices.txt` when the site is built.

## Fonts

The fonts below ship inside the website (in the `fonts` folder) so that your drawing looks the same everywhere
and nothing is loaded from another server. Excalidraw's own fonts are copied from the `@excalidraw/excalidraw`
package. Each line quotes the notice written inside the font file itself.

| Font | Notice in the font file | License |
| --- | --- | --- |
| Excalifont (page headings, hand-drawn text) | Copyright (c) 2024 by Excalidraw. All rights reserved. | SIL Open Font License 1.1, as published by Excalidraw |
| Virgil | Copyright (c) 2011 by Your Own Font Foundry. All rights reserved. | SIL Open Font License 1.1 (text stored in the font file) |
| Assistant (page text) | Copyright 2020 The Assistant Project Authors (https://github.com/hafontia/Assistant). Copyright 2010 The Source Sans Pro Authors (https://github.com/adobe-fonts/source-sans-pro), with Reserved Font Name 'Source'. | SIL Open Font License 1.1 (text stored in the font file) |
| Nunito | Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito) | SIL Open Font License (link stored in the font file: https://scripts.sil.org/OFL) |
| Lilita One | Copyright (c) 2011 Juan Montoreano (juan@remolacha.biz), with Reserved Font Names "Lilita One" | SIL Open Font License (link stored in the font file: http://scripts.sil.org/OFL) |
| Cascadia Code | (c) 2020 Microsoft Corporation. All Rights Reserved. | SIL Open Font License (link stored in the font file: https://scripts.sil.org/OFL) |
| Comic Shanns | Copyright (c) 2018 Shannon Miwa, (c) 2023 Jesus Gonzalez, (c) 2023 Rodrigo Batista de Moraes, (c) 2024 Fini Jastrow, (c) 2024 Kyle Beechly | MIT (full text below) |
| Liberation Sans | Digitized data 2007 Ascender Corporation. All rights reserved. | As stated in the font file; project page http://www.ascendercorp.com/liberation.html |
| Xiaolai SC (Chinese and Japanese characters) | Copyright (c) 2020 LXGW | The font file names no license; see https://github.com/excalidraw/excalidraw |
| Noto Sans Devanagari (Hindi and related scripts) | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/devanagari) | SIL Open Font License 1.1 (full text added to `third-party-notices.txt`) |

### Comic Shanns - MIT license

```
MIT License

Copyright (c) 2018 Shannon Miwa
Copyright (c) 2023 Jesus Gonzalez
Copyright (c) 2023 Rodrigo Batista de Moraes
Copyright (c) 2024 Fini Jastrow
Copyright (c) 2024 Kyle Beechly

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### SIL Open Font License 1.1

This is the license for the fonts marked "SIL Open Font License" above. Each font keeps the copyright line shown for it in the table.

```
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
