import {
	DeviceType,
	MediaSourceType,
	TimelineContentTypeAtem,
	TimelineContentTypeCasparCg,
	TSRTimelineObj,
} from 'timeline-state-resolver-types'
import { assertNever, parseMs } from '@shared/lib'

export function describeTimelineObject(obj: TSRTimelineObj, duration?: number) {
	let label: string = obj.id
	if (obj.content.deviceType === DeviceType.CASPARCG) {
		if (obj.content.type === TimelineContentTypeCasparCg.MEDIA) {
			label = obj.content.file
		} else if (obj.content.type === TimelineContentTypeCasparCg.TEMPLATE) {
			label = obj.content.name
		} else {
			// todo: for later:
			// assertNever(obj.content)
		}
	} else if (obj.content.deviceType === DeviceType.ATEM) {
		if (obj.content.type === TimelineContentTypeAtem.ME) {
			label = `Input ${obj.content.me.input}`
		} else if (obj.content.type === TimelineContentTypeAtem.DSK) {
			label = `Fill ${obj.content.dsk.sources?.fillSource} / Cut ${obj.content.dsk.sources?.cutSource}`
		} else if (obj.content.type === TimelineContentTypeAtem.AUX) {
			label = `Input ${obj.content.aux.input}`
		} else if (obj.content.type === TimelineContentTypeAtem.SSRC) {
			label = `SSrc Box`
		} else if (obj.content.type === TimelineContentTypeAtem.SSRCPROPS) {
			label = `SSrc Props`
		} else if (obj.content.type === TimelineContentTypeAtem.MACROPLAYER) {
			label = `Macro ${obj.content.macroPlayer.macroIndex}`
		} else if (obj.content.type === TimelineContentTypeAtem.AUDIOCHANNEL) {
			label = `Audio Channel Props`
		} else if (obj.content.type === TimelineContentTypeAtem.MEDIAPLAYER) {
			if (obj.content.mediaPlayer.sourceType === MediaSourceType.Clip) {
				label = `Clip ${obj.content.mediaPlayer.clipIndex}`
			} else if (obj.content.mediaPlayer.sourceType === MediaSourceType.Still) {
				label = `Still ${obj.content.mediaPlayer.stillIndex}`
			} else {
				assertNever(obj.content.mediaPlayer.sourceType)
			}
		} else {
			assertNever(obj.content)
		}
	} else {
		// todo: for later:
		// assertNever(obj.content)
	}

	// @ts-expect-error type
	const type: string = obj.content.type
	const contentTypeClassNames: string[] = [`device-${DeviceType[obj.content.deviceType]}`, type]

	let parsedDuration: ReturnType<typeof parseMs> | null = null
	if (typeof duration === 'number') {
		parsedDuration = parseMs(duration)
	}

	return {
		label,
		contentTypeClassNames,
		parsedDuration,
	}
}
