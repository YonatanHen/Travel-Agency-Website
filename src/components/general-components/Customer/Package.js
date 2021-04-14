import React, { Component } from 'react'
import '../../../css/Package.css'
// import Card from './Package-Components/Card'
import 'bootstrap/dist/css/bootstrap.min.css'

/* 
	the main idea behind Package Component:

	this component will represent Packages containing flights and hotels and rent car services in different places.

	it should be a boundle of smaller and reusable components, like card, courusel and much more.

*/
export default class Package extends Component {
	render() {
		return (
			<div className='package'>
				<div className='wrraper'>
					<label className='packageLabel' htmlFor='location'>
						Choose a Location:
					</label>
					<input className='packageInput' id='location' />
				</div>
			</div>
		)
	}
}
