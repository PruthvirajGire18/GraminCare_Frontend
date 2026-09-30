export async function createReferralQrDataUrl(verificationUrl) {
  let link
  try {
    link = new URL(verificationUrl, window.location.origin)
  } catch {
    throw new Error('Referral verification link is invalid')
  }
  if (
    link.origin !== window.location.origin
    || link.pathname !== '/referral/verify'
    || link.search
    || !/^#REF-[a-f\d]{64}$/i.test(link.hash)
  ) {
    throw new Error('Referral verification link is invalid')
  }
  const { default: QRCode } = await import('qrcode')
  return QRCode.toDataURL(link.href, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: { dark: '#14251b', light: '#ffffff' },
  })
}
