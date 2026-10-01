import { cva } from "class-variance-authority"

const imageVariants = cva("block", {
  variants: {
    layout: {
      intrinsic: "max-w-full h-auto",
      fill: "w-full h-full",
    },
    fit: {
      contain: "object-contain",
      cover: "object-cover",
    },
  },
  defaultVariants: { layout: "intrinsic", fit: "contain" },
})

type ImageProps = {
  src: string
  alt: string
  width: number
  height: number
  layout?: "intrinsic" | "fill"
  fit?: "contain" | "cover"
  loading?: "eager" | "lazy"
}

function Image({ src, alt, width, height, layout = "intrinsic", fit = "contain", loading = "eager" }: ImageProps) {
  if (typeof src !== "string" || !src.trim()) throw new Error("Image src must be a non-empty string.")
  if (typeof alt !== "string" || (alt !== "" && !alt.trim())) {
    throw new Error('Image alt must contain meaningful text, or be exactly "" for a decorative image.')
  }
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error("Image intrinsic dimensions must be positive integers.")
  }
  if (layout !== "intrinsic" && layout !== "fill") throw new Error("Image layout must be intrinsic or fill.")
  if (fit !== "contain" && fit !== "cover") throw new Error("Image fit must be contain or cover.")
  if (loading !== "eager" && loading !== "lazy") throw new Error("Image loading must be eager or lazy.")

  return (
    <img
      data-slot="image"
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      className={imageVariants({ layout, fit })}
    />
  )
}

export { Image }
