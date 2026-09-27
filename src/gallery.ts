import { Capacitor, registerPlugin } from '@capacitor/core'
import type { GalleryPhoto } from './dashboardState'

type NativeGalleryPhoto = Omit<GalleryPhoto, 'deletedAt'>

interface GalleryPlugin {
  pickImages(): Promise<{ photos: NativeGalleryPhoto[] }>
  deleteImage(options: { uri: string }): Promise<void>
}

const NativeGallery = registerPlugin<GalleryPlugin>('Gallery')

export async function pickGalleryPhotos() {
  if (!Capacitor.isNativePlatform()) return []
  const result = await NativeGallery.pickImages()
  return result.photos.map((photo) => ({ ...photo, deletedAt: null }))
}

export async function deleteGalleryPhotoFile(uri: string) {
  if (!Capacitor.isNativePlatform()) return
  await NativeGallery.deleteImage({ uri })
}

export function galleryPhotoSource(uri: string) {
  return Capacitor.convertFileSrc(uri)
}
