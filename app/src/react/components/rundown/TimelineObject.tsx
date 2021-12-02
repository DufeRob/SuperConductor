import { describeTimelineObject } from '@/lib/TimelineObj'
import { useMovable } from '@/lib/useMovable'
import { GUIContext } from '@/react/contexts/GUI'
import { IPCServerContext } from '@/react/contexts/IPCServer'
import { RundownContext } from '@/react/contexts/Rundown'
import classNames from 'classnames'
import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { TSRTimelineObj } from 'timeline-state-resolver-types'

export const TimelineObject: React.FC<{
	groupId: string
	partId: string
	partDuration: number
	obj: TSRTimelineObj
}> = ({ groupId, partId, obj, partDuration }) => {
	const { gui, updateGUI } = useContext(GUIContext)
	const dragDelta = useRef(0)
	const rundown = useContext(RundownContext)
	const ipcServer = useContext(IPCServerContext)
	const ref = useRef<HTMLDivElement>(null)
	const [trackWidth, setTrackWidth] = useState(0)
	const [isMoved, deltaX] = useMovable(ref.current)

	useLayoutEffect(() => {
		if (isMoved && ref.current && ref.current.parentElement) {
			const size = ref.current.parentElement.getBoundingClientRect()
			setTrackWidth(size.width)
		}
	}, [isMoved, ref.current])

	const start = (obj.enable as any).start
	const duration = (obj.enable as any).duration

	if (isMoved) {
		dragDelta.current = deltaX / trackWidth
	}

	useEffect(() => {
		if (isMoved) {
			return () => {
				ipcServer.updateTimelineObj({
					timelineObjId: obj.id,
					rundownId: rundown.id,
					partId: partId,
					groupId: groupId,
					layer: obj.layer,
					enableStart: Math.max(0, start + dragDelta.current * partDuration),
					enableDuration: duration,
				})
			}
		}
	}, [isMoved, partDuration, obj.id, rundown.id, partId, groupId, obj.layer, start, duration])

	const widthPercentage = (duration / partDuration) * 100 + '%'
	const startPercentage = Math.max(0, start / partDuration + (isMoved ? dragDelta.current : 0)) * 100 + '%'

	const description = describeTimelineObject(obj)

	return (
		<div
			ref={ref}
			className={classNames('object', description.contentTypeClassNames.join(' '), {
				selected: gui.selectedTimelineObjId === obj.id,
				moved: isMoved,
			})}
			style={{ width: widthPercentage, left: startPercentage }}
			onClick={() => {
				updateGUI({
					selectedGroupId: groupId,
					selectedPartId: partId,
					selectedTimelineObjId: obj.id,
				})
			}}
		>
			<div className="title">{description.label}</div>
		</div>
	)
}
