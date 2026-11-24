const ZIP_LOCAL_HEADER_SIG = 0x04034b50;
const ZIP_CENTRAL_HEADER_SIG = 0x02014b50;
const ZIP_EOCD_SIG = 0x06054b50;
const SCORE_GPIF_PATH = 'Content/score.gpif';

interface ZipCentralEntry {
  name: string;
  nameBytes: Uint8Array;
  compressionMethod: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  rawData: Uint8Array;
  modTime: number;
  modDate: number;
  externalAttrs: number;
}

interface XmlSection {
  start: number;
  end: number;
  content: string;
}

interface EpochTable {
  epochMap: Map<string, string>;
  firstByOldId: Map<string, string>;
  list: Array<{ oldId: string; epoch: number; newId: string }>;
  hasDuplicates: boolean;
}

let crcTable: Uint32Array | null = null;

const getCrcTable = (): Uint32Array => {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  crcTable = table;
  return table;
};

const computeCrc32 = (data: Uint8Array): number => {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const isZipBuffer = (bytes: Uint8Array): boolean => {
  return (
    bytes.length >= 22 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
};

const findEocdOffset = (view: DataView): number => {
  const minOffset = Math.max(0, view.byteLength - 65557);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset--) {
    if (view.getUint32(offset, true) === ZIP_EOCD_SIG) {
      return offset;
    }
  }
  return -1;
};

const readZipEntries = (bytes: Uint8Array): ZipCentralEntry[] | null => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEocdOffset(view);
  if (eocdOffset < 0) return null;

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  if (centralDirOffset >= bytes.length) return null;

  const decoder = new TextDecoder('utf-8');
  const entries: ZipCentralEntry[] = [];
  let cursor = centralDirOffset;

  for (let i = 0; i < entryCount; i++) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== ZIP_CENTRAL_HEADER_SIG) {
      return null;
    }

    const compressionMethod = view.getUint16(cursor + 10, true);
    const modTime = view.getUint16(cursor + 12, true);
    const modDate = view.getUint16(cursor + 14, true);
    const crc32 = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const externalAttrs = view.getUint32(cursor + 38, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);

    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLen);
    const name = decoder.decode(nameBytes);

    if (
      localHeaderOffset + 30 > bytes.length ||
      view.getUint32(localHeaderOffset, true) !== ZIP_LOCAL_HEADER_SIG
    ) {
      return null;
    }

    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) return null;

    entries.push({
      name,
      nameBytes,
      compressionMethod,
      crc32,
      compressedSize,
      uncompressedSize,
      rawData: bytes.subarray(dataStart, dataEnd),
      modTime,
      modDate,
      externalAttrs
    });

    cursor += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
};

const inflateRaw = async (compressed: Uint8Array): Promise<Uint8Array> => {
  const copy = new Uint8Array(compressed.byteLength);
  copy.set(compressed);
  const stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
};

const buildZipBuffer = (entries: ZipCentralEntry[]): ArrayBuffer => {
  let localTotal = 0;
  let centralTotal = 0;
  for (const entry of entries) {
    localTotal += 30 + entry.nameBytes.length + entry.rawData.length;
    centralTotal += 46 + entry.nameBytes.length;
  }

  const out = new Uint8Array(localTotal + centralTotal + 22);
  const view = new DataView(out.buffer);
  let localCursor = 0;
  let centralCursor = localTotal;

  for (const entry of entries) {
    const localOffset = localCursor;

    view.setUint32(localCursor, ZIP_LOCAL_HEADER_SIG, true);
    view.setUint16(localCursor + 4, 20, true);
    view.setUint16(localCursor + 6, 0, true);
    view.setUint16(localCursor + 8, entry.compressionMethod, true);
    view.setUint16(localCursor + 10, entry.modTime, true);
    view.setUint16(localCursor + 12, entry.modDate, true);
    view.setUint32(localCursor + 14, entry.crc32, true);
    view.setUint32(localCursor + 18, entry.compressedSize, true);
    view.setUint32(localCursor + 22, entry.uncompressedSize, true);
    view.setUint16(localCursor + 26, entry.nameBytes.length, true);
    view.setUint16(localCursor + 28, 0, true);
    out.set(entry.nameBytes, localCursor + 30);
    localCursor += 30 + entry.nameBytes.length;
    out.set(entry.rawData, localCursor);
    localCursor += entry.rawData.length;

    view.setUint32(centralCursor, ZIP_CENTRAL_HEADER_SIG, true);
    view.setUint16(centralCursor + 4, 20, true);
    view.setUint16(centralCursor + 6, 20, true);
    view.setUint16(centralCursor + 8, 0, true);
    view.setUint16(centralCursor + 10, entry.compressionMethod, true);
    view.setUint16(centralCursor + 12, entry.modTime, true);
    view.setUint16(centralCursor + 14, entry.modDate, true);
    view.setUint32(centralCursor + 16, entry.crc32, true);
    view.setUint32(centralCursor + 20, entry.compressedSize, true);
    view.setUint32(centralCursor + 24, entry.uncompressedSize, true);
    view.setUint16(centralCursor + 28, entry.nameBytes.length, true);
    view.setUint16(centralCursor + 30, 0, true);
    view.setUint16(centralCursor + 32, 0, true);
    view.setUint16(centralCursor + 34, 0, true);
    view.setUint16(centralCursor + 36, 0, true);
    view.setUint32(centralCursor + 38, entry.externalAttrs, true);
    view.setUint32(centralCursor + 42, localOffset, true);
    out.set(entry.nameBytes, centralCursor + 46);
    centralCursor += 46 + entry.nameBytes.length;
  }

  view.setUint32(centralCursor, ZIP_EOCD_SIG, true);
  view.setUint16(centralCursor + 4, 0, true);
  view.setUint16(centralCursor + 6, 0, true);
  view.setUint16(centralCursor + 8, entries.length, true);
  view.setUint16(centralCursor + 10, entries.length, true);
  view.setUint32(centralCursor + 12, centralTotal, true);
  view.setUint32(centralCursor + 16, localTotal, true);
  view.setUint16(centralCursor + 20, 0, true);

  return out.buffer;
};

const findContainerSection = (xml: string, containerTag: string, childTag: string): XmlSection | null => {
  const openRe = new RegExp(`<${containerTag}>\\s*<${childTag}\\b`);
  const match = openRe.exec(xml);
  if (!match) return null;

  const start = match.index;
  const endTag = `</${containerTag}>`;
  const endIdx = xml.indexOf(endTag, start);
  if (endIdx < 0) return null;

  const end = endIdx + endTag.length;
  return { start, end, content: xml.slice(start, end) };
};

const buildEpochTable = (sectionXml: string, itemTag: string): EpochTable => {
  const re = new RegExp(`<${itemTag}\\b[^>]*\\bid="(\\d+)"`, 'g');
  const epochMap = new Map<string, string>();
  const firstByOldId = new Map<string, string>();
  const seenOldIds = new Set<string>();
  const list: Array<{ oldId: string; epoch: number; newId: string }> = [];

  let epoch = 0;
  let prevOld = -1;
  let nextNewId = 0;
  let hasDuplicates = false;
  let match: RegExpExecArray | null;

  while ((match = re.exec(sectionXml)) !== null) {
    const oldId = match[1];
    if (seenOldIds.has(oldId)) {
      hasDuplicates = true;
    } else {
      seenOldIds.add(oldId);
    }

    const oldNum = Number(oldId);
    if (prevOld !== -1 && oldNum <= prevOld) {
      epoch += 1;
    }
    prevOld = oldNum;

    const newId = String(nextNewId++);
    epochMap.set(`${epoch}:${oldId}`, newId);
    if (!firstByOldId.has(oldId)) {
      firstByOldId.set(oldId, newId);
    }
    list.push({ oldId, epoch, newId });
  }

  return { epochMap, firstByOldId, list, hasDuplicates };
};

const lookupEpochId = (table: EpochTable, epoch: number, oldId: string): string => {
  return (
    table.epochMap.get(`${epoch}:${oldId}`) ??
    table.epochMap.get(`${epoch - 1}:${oldId}`) ??
    table.epochMap.get(`${epoch + 1}:${oldId}`) ??
    table.firstByOldId.get(oldId) ??
    oldId
  );
};

export const repairGpifDuplicateIds = (xml: string): string | null => {
  const masterBarsSec = findContainerSection(xml, 'MasterBars', 'MasterBar');
  const barsSec = findContainerSection(xml, 'Bars', 'Bar');
  const voicesSec = findContainerSection(xml, 'Voices', 'Voice');
  const beatsSec = findContainerSection(xml, 'Beats', 'Beat');
  const notesSec = findContainerSection(xml, 'Notes', 'Note');

  if (!masterBarsSec || !barsSec || !voicesSec || !beatsSec || !notesSec) {
    return null;
  }

  const barTable = buildEpochTable(barsSec.content, 'Bar');
  const voiceTable = buildEpochTable(voicesSec.content, 'Voice');
  const beatTable = buildEpochTable(beatsSec.content, 'Beat');
  const noteTable = buildEpochTable(notesSec.content, 'Note');

  if (
    !barTable.hasDuplicates &&
    !voiceTable.hasDuplicates &&
    !beatTable.hasDuplicates &&
    !noteTable.hasDuplicates
  ) {
    return null;
  }

  const mbBarMatches = [...masterBarsSec.content.matchAll(/<Bars>([^<]*)<\/Bars>/g)];
  const matrix = mbBarMatches.map(m => m[1].trim().split(/\s+/).filter(Boolean));
  const numMeasures = matrix.length;
  const maxCols = matrix.reduce((max, row) => Math.max(max, row.length), 0);
  const newMatrix = matrix.map(row => [...row]);

  let barRefEpoch = 0;
  let prevBarRef = -1;
  for (let col = 0; col < maxCols; col++) {
    for (let row = 0; row < numMeasures; row++) {
      const oldId = matrix[row][col];
      if (!oldId || oldId === '-1') continue;
      const oldNum = Number(oldId);
      if (prevBarRef !== -1 && oldNum <= prevBarRef) {
        barRefEpoch += 1;
      }
      prevBarRef = oldNum;
      newMatrix[row][col] = lookupEpochId(barTable, barRefEpoch, oldId);
    }
  }

  let mbIdx = 0;
  const newMasterBars = masterBarsSec.content.replace(/<Bars>([^<]*)<\/Bars>/g, () => {
    return `<Bars>${newMatrix[mbIdx++].join(' ')}</Bars>`;
  });

  let barDefIdx = 0;
  let voiceRefEpoch = 0;
  let prevVoiceRef = -1;
  const newBars = barsSec.content.replace(/<Bar\b([^>]*)>([\s\S]*?)<\/Bar>/g, (_match, attrs: string, body: string) => {
    const newId = barTable.list[barDefIdx++]?.newId;
    const nextAttrs = newId !== undefined ? attrs.replace(/\bid="\d+"/, `id="${newId}"`) : attrs;
    const nextBody = body.replace(/<Voices>([^<]*)<\/Voices>/, (_vm, raw: string) => {
      const ids = raw.trim().split(/\s+/).filter(Boolean).map(oldVid => {
        if (oldVid === '-1') return '-1';
        const n = Number(oldVid);
        if (prevVoiceRef !== -1 && n <= prevVoiceRef) {
          voiceRefEpoch += 1;
        }
        prevVoiceRef = n;
        return lookupEpochId(voiceTable, voiceRefEpoch, oldVid);
      });
      return `<Voices>${ids.join(' ')}</Voices>`;
    });
    return `<Bar${nextAttrs}>${nextBody}</Bar>`;
  });

  let voiceDefIdx = 0;
  let beatRefEpoch = 0;
  let prevBeatRef = -1;
  const newVoices = voicesSec.content.replace(/<Voice\b([^>]*)>([\s\S]*?)<\/Voice>/g, (_match, attrs: string, body: string) => {
    const newId = voiceTable.list[voiceDefIdx++]?.newId;
    const nextAttrs = newId !== undefined ? attrs.replace(/\bid="\d+"/, `id="${newId}"`) : attrs;
    const nextBody = body.replace(/<Beats>([^<]*)<\/Beats>/, (_bm, raw: string) => {
      const ids = raw.trim().split(/\s+/).filter(Boolean).map(oldBid => {
        if (oldBid === '-1') return '-1';
        const n = Number(oldBid);
        if (prevBeatRef !== -1 && n <= prevBeatRef) {
          beatRefEpoch += 1;
        }
        prevBeatRef = n;
        return lookupEpochId(beatTable, beatRefEpoch, oldBid);
      });
      return `<Beats>${ids.join(' ')}</Beats>`;
    });
    return `<Voice${nextAttrs}>${nextBody}</Voice>`;
  });

  let beatDefIdx = 0;
  let noteRefEpoch = 0;
  let prevNoteRef = -1;
  const newBeats = beatsSec.content.replace(/<Beat\b([^>]*)>([\s\S]*?)<\/Beat>/g, (_match, attrs: string, body: string) => {
    const newId = beatTable.list[beatDefIdx++]?.newId;
    const nextAttrs = newId !== undefined ? attrs.replace(/\bid="\d+"/, `id="${newId}"`) : attrs;
    const nextBody = body.replace(/<Notes>([^<]*)<\/Notes>/, (_nm, raw: string) => {
      const ids = raw.trim().split(/\s+/).filter(Boolean).map(oldNid => {
        if (oldNid === '-1') return '-1';
        const n = Number(oldNid);
        if (prevNoteRef !== -1 && n <= prevNoteRef) {
          noteRefEpoch += 1;
        }
        prevNoteRef = n;
        return lookupEpochId(noteTable, noteRefEpoch, oldNid);
      });
      return `<Notes>${ids.join(' ')}</Notes>`;
    });
    return `<Beat${nextAttrs}>${nextBody}</Beat>`;
  });

  let noteDefIdx = 0;
  const newNotes = notesSec.content.replace(/<Note\b([^>]*)>/g, (_match, attrs: string) => {
    const newId = noteTable.list[noteDefIdx++]?.newId;
    const nextAttrs = newId !== undefined ? attrs.replace(/\bid="\d+"/, `id="${newId}"`) : attrs;
    return `<Note${nextAttrs}>`;
  });

  const replacements = [
    { ...masterBarsSec, next: newMasterBars },
    { ...barsSec, next: newBars },
    { ...voicesSec, next: newVoices },
    { ...beatsSec, next: newBeats },
    { ...notesSec, next: newNotes }
  ].sort((a, b) => b.start - a.start);

  let fixedXml = xml;
  for (const part of replacements) {
    fixedXml = fixedXml.slice(0, part.start) + part.next + fixedXml.slice(part.end);
  }

  return fixedXml;
};

/**
 * Repairs Guitar Pro 7/8 (.gp) files whose Content/score.gpif contains duplicate
 * Bar/Voice/Beat/Note IDs (e.g. from older alphaTab 1.8.x exports) so alphaTab can
 * load them cleanly. Returns the original buffer untouched if no repair is needed.
 */
export const repairGpBufferIfNeeded = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
  try {
    const bytes = new Uint8Array(buffer);
    if (!isZipBuffer(bytes)) return buffer;

    const entries = readZipEntries(bytes);
    if (!entries) return buffer;

    const gpifIndex = entries.findIndex(entry => entry.name === SCORE_GPIF_PATH);
    if (gpifIndex < 0) return buffer;

    const gpifEntry = entries[gpifIndex];
    let xmlBytes: Uint8Array;
    if (gpifEntry.compressionMethod === 0) {
      xmlBytes = gpifEntry.rawData;
    } else if (gpifEntry.compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
      xmlBytes = await inflateRaw(gpifEntry.rawData);
    } else {
      return buffer;
    }

    const xml = new TextDecoder('utf-8').decode(xmlBytes);
    const fixedXml = repairGpifDuplicateIds(xml);
    if (fixedXml === null) return buffer;

    const encoded = new TextEncoder().encode(fixedXml);
    const updatedEntries = entries.map((entry, idx) => (
      idx === gpifIndex
        ? {
            ...entry,
            compressionMethod: 0,
            crc32: computeCrc32(encoded),
            compressedSize: encoded.length,
            uncompressedSize: encoded.length,
            rawData: encoded
          }
        : entry
    ));

    return buildZipBuffer(updatedEntries);
  } catch {
    return buffer;
  }
};
