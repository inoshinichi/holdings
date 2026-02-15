export function toZenginKana(text: string): string {
  if (!text) return ''

  // 全角カナ→半角カナ
  let result = text.replace(/[ァ-ン]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  )

  // 全角英数字→半角
  result = result.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  )

  // 全角スペース→半角スペース
  result = result.replace(/　/g, ' ')

  // 全角記号変換
  const symbolMap: Record<string, string> = {
    '（': '(',
    '）': ')',
    '－': '-',
    '．': '.',
    '，': ',',
    '／': '/',
  }
  for (const [key, value] of Object.entries(symbolMap)) {
    result = result.replace(new RegExp(key, 'g'), value)
  }

  // 許可されない文字を削除（半角カナ、半角英数字、一部記号のみ許可）
  result = result.replace(/[^ｦ-ﾝﾞﾟA-Za-z0-9()\-.,/\s]/g, '')

  return result.toUpperCase()
}

export function padLeft(str: string, length: number, char: string): string {
  let s = String(str)
  while (s.length < length) {
    s = char + s
  }
  return s.substring(0, length)
}

export function padRight(str: string, length: number, char: string): string {
  let s = String(str)
  while (s.length < length) {
    s = s + char
  }
  return s.substring(0, length)
}

export function convertAccountType(accountType: string | null | undefined): string {
  switch (accountType) {
    case '普通':
    case '普通預金':
      return '1'
    case '当座':
    case '当座預金':
      return '2'
    case '貯蓄':
    case '貯蓄預金':
      return '4'
    default:
      return '1'
  }
}
