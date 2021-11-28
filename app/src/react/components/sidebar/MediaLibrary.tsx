import React, { useContext, useEffect, useState } from 'react'
import { AppModel } from '@/models/AppModel'
import { InfoGroup } from './InfoGroup'
import { MediaInfo } from './MediaInfo'
import { Field, Form, Formik, FormikProps } from 'formik'
import { bytesToSize } from '@/lib/bytesToSize'
import { getAllParts, getDefaultMappingLayer, getDefaultPart } from '@/lib/getDefaults'
import classNames from 'classnames'
import { IPCServerContext } from '@/react/App'

type PropsType = {
	appData: AppModel
}

export const MediaLibrary = (props: PropsType) => {
	const ipcServer = useContext(IPCServerContext)

	const [selectedFilename, setSelectedFilename] = useState<string | undefined>()
	const selectedMedia = props.appData.media.find((item) => item.name === selectedFilename)

	const [refreshing, setRefreshing] = useState(false)

	const defaultPart = getDefaultPart(props.appData)
	const defaultLayer = getDefaultMappingLayer(props.appData.mappings)

	useEffect(() => {
		setRefreshing(false)
		return () => {}
	}, [props])

	return (
		<div className="sidebar media-library-sidebar">
			<InfoGroup
				title="Available media"
				enableRefresh={true}
				refreshActive={refreshing}
				onRefreshClick={() => {
					setRefreshing(true)
					ipcServer.refreshMedia()
				}}
			>
				<table className="selectable">
					<thead>
						<tr>
							<th></th>
							<th>Name</th>
							<th>Type</th>
							<th>Size</th>
							<th>Duration</th>
						</tr>
					</thead>
					<tbody>
						{props.appData.media.map((item, index) => {
							return (
								<tr
									key={index}
									onClick={() => {
										if (selectedFilename === item.name) {
											setSelectedFilename(undefined)
										} else {
											setSelectedFilename(item.name)
										}
									}}
									className={classNames({ selected: item.name === selectedFilename })}
								>
									<td>
										<img className="thumbnail" src={item.thumbnail} alt={item.name} />
									</td>
									<td>{item.name}</td>
									<td>{item.type}</td>
									<td>{bytesToSize(item.size)}</td>
									<td>{item.duration}</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</InfoGroup>

			{selectedMedia && (
				<>
					<MediaInfo media={selectedMedia} />
					{defaultPart && defaultLayer && (
						<div className="add-to-timeline">
							<Formik
								initialValues={{ partId: defaultPart.part.id, layerId: defaultLayer }}
								onSubmit={(values, actions) => {
									if (!values.partId || !values.layerId) {
										return
									}

									const rd = getAllParts(props.appData).find((r) => r.part.id === values.partId)
									if (!rd) return

									ipcServer.addMediaToTimeline({
										groupId: rd.group.id,
										partId: rd.part.id,
										layerId: values.layerId,
										filename: selectedMedia.name,
									})
								}}
							>
								{(fProps: FormikProps<any>) => (
									<Form>
										<div className="label">Add to timeline</div>
										<div className="dropdowns">
											<Field as="select" name="partId">
												{getAllParts(props.appData).map((rd) => {
													return (
														<option key={rd.part.id} value={rd.part.id}>
															{rd.name}
														</option>
													)
												})}
											</Field>
											<Field as="select" name="layerId">
												{props.appData.mappings &&
													Object.keys(props.appData.mappings).map((key) => (
														<option key={key} value={key}>
															{key}
														</option>
													))}
											</Field>
										</div>
										<div className="btn-row-right">
											<button className="btn form" type="submit">
												Add
											</button>
										</div>
									</Form>
								)}
							</Formik>
						</div>
					)}
				</>
			)}
		</div>
	)
}
