import {BaseComponent as Component, Column, Panel, Row, VButton, VText, BaseProps} from "../../../Frame/ReactGlobals";
import {colors, styles} from "../../../Frame/Styles";
import {VRect} from "../../../Frame/Graphics/VectorStructs";
import Drawer from "react-native-drawer";
import Chart from "react-native-chart";
import {MKRangeSlider} from "react-native-material-kit";
import NumberPickerDialog from "react-native-numberpicker-dialog";

import LeftPanel from "./LeftPanel";
import {observer} from "mobx-react/native";
import {View, Text} from "react-native";
import {LL} from "../../../LucidLink";
import GraphRowUI from "./GraphRowUI";
import Moment from "moment";
import GraphOverlayUI from "./GraphOverlayUI";
import {Notify} from "../../../Frame/Globals";
import {Session} from "../Session";
import SleepSegmentsUI from "./SleepSegmentsUI";

@observer
export default class GraphUI extends Component<{} & BaseProps, {}> {
	leftPanel = null;
	ToggleLeftPanelOpen() {
		if (this.leftPanel._open)
			this.leftPanel.close();
		else
			this.leftPanel.open();
	}

	render() {
		var node = LL.tracker;
		
		const drawerStyles = {
			drawer: {shadowColor: "#000000", shadowOpacity: .8, shadowRadius: 3},
			main: {paddingLeft: 3},
		};
		
		return (
			<Drawer ref={comp=>this.leftPanel = comp}
					content={<LeftPanel parent={this}/>}
					type="overlay" openDrawerOffset={0.7} panCloseMask={0.7} tapToClose={true}
					disabled={true} // temp
					closedDrawerOffset={-3} styles={drawerStyles}>
				<Column style={{flex: 1, backgroundColor: colors.background}}>
					<Row style={{padding: 3, height: 56, backgroundColor: "#303030"}}>
						{/*<VButton text="Options" style={{width: 100}} onPress={this.ToggleLeftPanelOpen}/>*/}
						<VText ml={10} mt={10}>Rows/days: </VText>
						<VButton text={node.rowCount.toString()} ml={3} mt={5} style={{width: 100, height: 32}}
							onPress={()=> {
								var values = [];
								for (let val = 1; val <= 10; val++)
									values.push(val);
								NumberPickerDialog.show({
									selectedValueIndex: values.indexOf(node.rowCount),
									values: values.Select(a=>a.toString()),
									positiveButtonLabel: "Ok", negativeButtonLabel: "Cancel",
									title: "Rows/days",
									message: "Select number of rows/days to show on-screen at once.",
								}).then(id=> {
									if (id == -1) return;
									let val = values[id];
									node.rowCount = val;
								});
							}}/>
						<Panel style={{flex: 1}}/>
						<VButton text="Refresh" ml={3} mt={5} style={{width: 100, height: 32}} onPress={()=>this.chart.Refresh()}/>
					</Row>
					<Row style={{marginTop: -7, flex: 1}}>
						<ChartsUI ref={c=>this.chart = c}/>
					</Row>
				</Column>
			</Drawer>
		);
	}

	chart: ChartsUI;
}

@observer
class ChartsUI extends Component<{}, {}> {
	state = {width: -1, height: -1};

	ComponentDidMountOrUpdate() {
		var node = LL.tracker;
		var now = Moment();
		var rangeStart = now.clone().startOf("day").subtract(node.rowCount, "day");
		var rangeEnd = now.clone().endOf("day");
		LL.tracker.LoadSessionsForRange(rangeStart, rangeEnd);
	}
	
    render() {
		var {width, height} = this.state;
		var node = LL.tracker;

		var now = Moment();
		var dayStart = now.clone().startOf("day");
		//var dayEnd = now.clone().endOf("day");
		var dayEnd = dayStart.clone().add(1, "day");

		var rows = [];
		if (width != -1) { // if width not obtained from OnLayout yet, don't render children
			for (let offset = -(node.rowCount - 1); offset <= 0; offset++) {
				let startTime = dayStart.clone().add(offset, "days");
				let endTime = dayEnd.clone().add(offset, "days");
				let rowHeight = height / node.rowCount;
				rows.push(
					<ChartUI key={startTime.toString()} {...{startTime, endTime, width, height: rowHeight}}/>
				);
			}
		}

        return (
			<View style={{flex: 1, backgroundColor: colors.background}} onLayout={this.OnLayout}>
				{rows}
            </View>
        );
    }

	//PostRender() {
	OnLayout(e) {
		var {x, y, width, height} = e.nativeEvent.layout;
		if (width != this.state.width || height != this.state.height)
			this.setState({width, height});
	}

	Refresh() {
		var {height} = this.state;
		this.setState({height: height - 1}, ()=>this.setState({height}));
	}
}

@observer
class ChartUI extends Component<{startTime: Moment.Moment, endTime: Moment.Moment, width: number, height: number}, {}> {
	/*componentWillReact() {
        Log("Re-rendering ChartUI, because... " + new Error().stack);
    }*/
	
	render() {
		var {startTime, endTime, width, height} = this.props;
		var node = LL.tracker;

		var innerHeight = height - 21;

		var events = node.GetEventsForRange(startTime, endTime);
		var currentOffset = 0;
		var rowUIs = LL.tracker.scriptRunner.graphRows.map((row, index)=> {
			var result = <GraphRowUI {...{startTime, endTime, events, row, width, height: innerHeight}} key={index}
				style={{top: height * currentOffset}}/>;
			currentOffset += row.height;
			return result;
		});

		var overlay = LL.tracker.scriptRunner.graphOverlay;
		var overlayUI = null;
		if (overlay) {
			let overlayEvents = events.Where(a=>overlay.events.Contains(a.type));
			overlayUI = (
				<GraphOverlayUI {...{startTime, endTime, width, height: innerHeight, overlay}} events={overlayEvents}/>
			);
		}
		
		var mainLineColor = "#e1cd00";
		var mainLinePoints = [[0, 0]]; // placeholder
        return (
			<Row style={{width, height, backgroundColor: colors.background}}>
				<Chart style={{width, height, paddingRight: 10}}
					minX={0} maxX={24} legendStepsX={25}
					minY={0} maxY={1} legendStepsY={2} showYAxisLabels={false} yAxisWidth={0}
					axisColor="#AAA" axisLabelColor="#AAA" gridColor="#777"
					type="line" color={[mainLineColor]} data={[mainLinePoints]}/>
				{rowUIs}
				{overlayUI}
				{/* put this later so it's clickable */}
				<SleepSegmentsUI {...{startTime, endTime}} height={innerHeight} style={{top: 0}}
					sleepSessions={node.GetSleepSessionsForRange(startTime, endTime)}/>
            </Row>
        );
	}
}