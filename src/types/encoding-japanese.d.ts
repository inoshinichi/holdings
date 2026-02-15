declare module 'encoding-japanese' {
  type EncodingName =
    | 'UTF32'
    | 'UTF16'
    | 'UTF16BE'
    | 'UTF16LE'
    | 'BINARY'
    | 'ASCII'
    | 'JIS'
    | 'UTF8'
    | 'EUCJP'
    | 'SJIS'
    | 'UNICODE'
    | 'AUTO'

  interface ConvertOptions {
    to: EncodingName
    from?: EncodingName
    type?: 'string' | 'arraybuffer' | 'array'
    bom?: boolean | string
    fallback?: 'html-entity' | 'html-entity-hex' | 'error'
  }

  function detect(data: number[] | Uint8Array | string): EncodingName | false
  function convert(data: number[] | Uint8Array, options: ConvertOptions): number[]
  function convert(data: string, options: ConvertOptions & { type: 'string' }): string
  function stringToCode(str: string): number[]
  function codeToString(code: number[] | Uint8Array): string
  function urlEncode(data: number[] | Uint8Array): string
  function urlDecode(str: string): number[]

  const Encoding: {
    detect: typeof detect
    convert: typeof convert
    stringToCode: typeof stringToCode
    codeToString: typeof codeToString
    urlEncode: typeof urlEncode
    urlDecode: typeof urlDecode
  }

  export default Encoding
  export { detect, convert, stringToCode, codeToString, urlEncode, urlDecode }
}
