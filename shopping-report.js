(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.ScoutShoppingReport=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const encoder=new TextEncoder();
  const XLSX_MIME="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  let crcTable=null;

  function xmlEscape(value){
    return String(value??"")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&apos;");
  }
  function colName(index){
    let n=index+1,out="";
    while(n>0){n--;out=String.fromCharCode(65+n%26)+out;n=Math.floor(n/26);}
    return out;
  }
  function safeSheetName(name,used){
    let base=String(name||"Sheet").replace(/[\\\/?*\[\]:]/g," ").replace(/\s+/g," ").trim().slice(0,31)||"Sheet";
    let out=base,n=2;
    while(used.has(out.toLowerCase())){
      const suffix=" "+n++;
      out=base.slice(0,31-suffix.length)+suffix;
    }
    used.add(out.toLowerCase());
    return out;
  }
  function cellDescriptor(value){
    if(value&&typeof value==="object"&&!Array.isArray(value)&&Object.prototype.hasOwnProperty.call(value,"value"))return value;
    return {value};
  }
  function isNumberCell(d){
    return (d.type==="number"||d.style==="money")&&Number.isFinite(Number(d.value));
  }
  function normalizeText(value){return String(value??"");}

  function collectSharedStrings(sheets){
    const strings=[],index=new Map();
    function add(value){
      const s=normalizeText(value);
      if(!index.has(s)){index.set(s,strings.length);strings.push(s);}
    }
    for(const sheet of sheets){
      add(sheet.title||sheet.name);
      add(sheet.subtitle||"");
      const headers=Array.isArray(sheet.headers)&&sheet.headers.length?sheet.headers:["Items"];
      headers.forEach(add);
      for(const row of (Array.isArray(sheet.rows)?sheet.rows:[])){
        const values=Array.isArray(row)?row:[row];
        for(const value of values){
          const d=cellDescriptor(value);
          if(d.value===null||d.value===undefined||d.value===""||isNumberCell(d))continue;
          add(d.value);
        }
      }
    }
    return {strings,index};
  }
  function sharedStringsXml(shared){
    const body=shared.strings.map(s=>`<si><t xml:space="preserve">${xmlEscape(s)}</t></si>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.strings.length}" uniqueCount="${shared.strings.length}">${body}</sst>`;
  }
  function cellXml(ref,value,shared,styleId=4){
    const d=cellDescriptor(value);
    const style=d.style==="money"?5:(Number.isInteger(d.style)?d.style:styleId);
    const v=d.value;
    if(v===null||v===undefined||v==="")return `<c r="${ref}" s="${style}"/>`;
    if(isNumberCell(d))return `<c r="${ref}" s="${style}"><v>${Number(v)}</v></c>`;
    const key=normalizeText(v),idx=shared.index.get(key);
    if(!Number.isInteger(idx))throw new Error("Shared string was not registered: "+key.slice(0,80));
    return `<c r="${ref}" s="${style}" t="s"><v>${idx}</v></c>`;
  }
  function rowXml(rowNum,values,shared,styleId=4,height=""){
    const cells=values.map((value,i)=>cellXml(colName(i)+rowNum,value,shared,styleId)).join("");
    const h=height?` ht="${height}" customHeight="1"`:"";
    return `<row r="${rowNum}"${h}>${cells}</row>`;
  }
  function worksheetXml(sheet,shared){
    const headers=Array.isArray(sheet.headers)&&sheet.headers.length?sheet.headers:["Items"];
    const rows=Array.isArray(sheet.rows)?sheet.rows:[];
    const lastCol=colName(headers.length-1);
    const lastRow=Math.max(4,4+rows.length);
    const widths=(sheet.widths||headers.map(()=>18)).map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${Math.max(7,Math.min(60,Number(w)||18))}" customWidth="1"/>`).join("");
    const data=[
      rowXml(1,[sheet.title||sheet.name],shared,1,24),
      rowXml(2,[sheet.subtitle||""],shared,2,32),
      rowXml(4,headers,shared,3,28),
      ...rows.map((r,i)=>rowXml(i+5,Array.isArray(r)?r:[r],shared,4,30))
    ].join("");
    const filter=rows.length?`<autoFilter ref="A4:${lastCol}${lastRow}"/>`:"";
    const merges=headers.length>1?`<mergeCells count="2"><mergeCell ref="A1:${lastCol}1"/><mergeCell ref="A2:${lastCol}2"/></mergeCells>`:"";
    const orientation=sheet.orientation==="portrait"?"portrait":"landscape";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${lastCol}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A5" sqref="A5"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${widths}</cols>
  <sheetData>${data}</sheetData>
  ${filter}
  ${merges}
  <printOptions horizontalCentered="0" verticalCentered="0"/>
  <pageMargins left="0.3" right="0.3" top="0.45" bottom="0.45" header="0.2" footer="0.2"/>
  <pageSetup orientation="${orientation}" paperSize="9" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
  }
  function stylesXml(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="$#,##0.00"/></numFmts>
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="16"/><color rgb="FF173F33"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E5B47"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3E2B6"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD7DDD9"/></left><right style="thin"><color rgb="FFD7DDD9"/></right><top style="thin"><color rgb="FFD7DDD9"/></top><bottom style="thin"><color rgb="FFD7DDD9"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  }
  function contentTypesXml(sheetCount){
    const sheets=Array.from({length:sheetCount},(_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${sheets}
</Types>`;
  }
  function rootRelsXml(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
  }
  function workbookXml(sheets){
    const sheetTags=sheets.map((s,i)=>`<sheet name="${xmlEscape(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("");
    const printTitles=sheets.map((s,i)=>`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${xmlEscape(s.name.replace(/'/g,"''"))}'!$4:$4</definedName>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="18000" windowHeight="10000"/></bookViews>
  <sheets>${sheetTags}</sheets>
  <definedNames>${printTitles}</definedNames>
  <calcPr calcId="191029"/>
</workbook>`;
  }
  function workbookRelsXml(sheetCount){
    const rels=Array.from({length:sheetCount},(_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels}
  <Relationship Id="rId${sheetCount+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId${sheetCount+2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;
  }
  function coreXml(options,now){
    const creator=options.creator||"HOF Card Scout";
    const subject=options.subject||"Offline shopping report";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>${xmlEscape(creator)}</dc:creator><cp:lastModifiedBy>${xmlEscape(creator)}</cp:lastModifiedBy><dc:subject>${xmlEscape(subject)}</dc:subject>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now.toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now.toISOString()}</dcterms:modified>
</cp:coreProperties>`;
  }
  function appXml(sheets){
    const titles=sheets.map(s=>`<vt:lpstr>${xmlEscape(s.name)}</vt:lpstr>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>HOF Card Scout</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts><Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion>
</Properties>`;
  }
  function getCrcTable(){
    if(crcTable)return crcTable;
    crcTable=new Uint32Array(256);
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
      crcTable[n]=c>>>0;
    }
    return crcTable;
  }
  function crc32(bytes){
    const table=getCrcTable();
    let c=0xFFFFFFFF;
    for(let i=0;i<bytes.length;i++)c=table[(c^bytes[i])&0xFF]^(c>>>8);
    return (c^0xFFFFFFFF)>>>0;
  }
  function dosStamp(date){
    const year=Math.max(1980,date.getFullYear());
    return {
      time:((date.getHours()&31)<<11)|((date.getMinutes()&63)<<5)|((Math.floor(date.getSeconds()/2))&31),
      date:(((year-1980)&127)<<9)|(((date.getMonth()+1)&15)<<5)|(date.getDate()&31)
    };
  }
  function concat(parts){
    const size=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(size);
    let off=0;for(const p of parts){out.set(p,off);off+=p.length;}return out;
  }
  function localHeader(nameBytes,dataBytes,crc,stamp){
    const h=new Uint8Array(30+nameBytes.length),v=new DataView(h.buffer);
    v.setUint32(0,0x04034B50,true);v.setUint16(4,20,true);v.setUint16(6,0,true);v.setUint16(8,0,true);
    v.setUint16(10,stamp.time,true);v.setUint16(12,stamp.date,true);v.setUint32(14,crc,true);v.setUint32(18,dataBytes.length,true);v.setUint32(22,dataBytes.length,true);
    v.setUint16(26,nameBytes.length,true);v.setUint16(28,0,true);h.set(nameBytes,30);return h;
  }
  function centralHeader(nameBytes,dataBytes,crc,stamp,offset){
    const h=new Uint8Array(46+nameBytes.length),v=new DataView(h.buffer);
    v.setUint32(0,0x02014B50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0,true);v.setUint16(10,0,true);
    v.setUint16(12,stamp.time,true);v.setUint16(14,stamp.date,true);v.setUint32(16,crc,true);v.setUint32(20,dataBytes.length,true);v.setUint32(24,dataBytes.length,true);
    v.setUint16(28,nameBytes.length,true);v.setUint16(30,0,true);v.setUint16(32,0,true);v.setUint16(34,0,true);v.setUint16(36,0,true);v.setUint32(38,0,true);v.setUint32(42,offset,true);
    h.set(nameBytes,46);return h;
  }
  function endOfCentral(entries,centralSize,centralOffset){
    const h=new Uint8Array(22),v=new DataView(h.buffer);
    v.setUint32(0,0x06054B50,true);v.setUint16(4,0,true);v.setUint16(6,0,true);v.setUint16(8,entries,true);v.setUint16(10,entries,true);v.setUint32(12,centralSize,true);v.setUint32(16,centralOffset,true);v.setUint16(20,0,true);return h;
  }
  function zipStore(files,now){
    const stamp=dosStamp(now),locals=[],centrals=[];
    let offset=0;
    for(const file of files){
      const nameBytes=encoder.encode(file.name),dataBytes=encoder.encode(file.content),crc=crc32(dataBytes),header=localHeader(nameBytes,dataBytes,crc,stamp);
      locals.push(header,dataBytes);centrals.push(centralHeader(nameBytes,dataBytes,crc,stamp,offset));offset+=header.length+dataBytes.length;
    }
    const centralOffset=offset,centralSize=centrals.reduce((n,p)=>n+p.length,0);
    return concat([...locals,...centrals,endOfCentral(files.length,centralSize,centralOffset)]);
  }
  function buildWorkbook(inputSheets,options={}){
    if(!Array.isArray(inputSheets)||!inputSheets.length)throw new Error("At least one worksheet is required.");
    const used=new Set();
    const sheets=inputSheets.map(s=>({...s,name:safeSheetName(s.name||s.title,used)}));
    const now=options.now instanceof Date?options.now:new Date();
    const shared=collectSharedStrings(sheets);
    const files=[
      {name:"[Content_Types].xml",content:contentTypesXml(sheets.length)},
      {name:"_rels/.rels",content:rootRelsXml()},
      {name:"docProps/core.xml",content:coreXml(options,now)},
      {name:"docProps/app.xml",content:appXml(sheets)},
      {name:"xl/workbook.xml",content:workbookXml(sheets)},
      {name:"xl/_rels/workbook.xml.rels",content:workbookRelsXml(sheets.length)},
      {name:"xl/styles.xml",content:stylesXml()},
      {name:"xl/sharedStrings.xml",content:sharedStringsXml(shared)},
      ...sheets.map((s,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,content:worksheetXml(s,shared)}))
    ];
    return zipStore(files,now);
  }
  function downloadWorkbook(sheets,filename,options={}){
    if(typeof document==="undefined"||typeof Blob==="undefined"||typeof URL==="undefined")throw new Error("Workbook download requires a browser.");
    const bytes=buildWorkbook(sheets,options),blob=new Blob([bytes],{type:XLSX_MIME}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=String(filename||"HOF-Card-Scout-Shopping-Report.xlsx").replace(/\.xlsx$/i,"")+".xlsx";
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    return bytes.length;
  }

  return {buildWorkbook,downloadWorkbook,XLSX_MIME};
});