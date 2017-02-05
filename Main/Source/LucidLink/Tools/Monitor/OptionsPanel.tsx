import {observer} from "mobx-react/native";
import {colors} from "../../../Frame/Styles";
import {Text} from "react-native";
import Spinner from "rn-spinner";
import {BaseComponent, Column, Row, VText} from "../../../Frame/ReactGlobals";
import {LL} from "../../../LucidLink";
import {VSwitch, VSwitch_Auto} from "../../../Packages/ReactNativeComponents/VSwitch";

@observer
export default class OptionsPanel extends BaseComponent<any, any> {
	render() {
		var {parent} = this.props;
		var node = LL.tools.monitor;
		
		return (
			<Column style={{flex: 1, backgroundColor: colors.background_light}}>
				<Row>
					<Text style={{marginLeft: 5, marginTop: 5}}>UI update interval: </Text>
					<Spinner min={1} max={1000} default={node.updateInterval} color={colors.background_dark} numColor={colors.text_dark}
						onNumChange={value=> {
							node.updateInterval = value;
						}}/>
				</Row>
				<Row>
					<VText mt12>Channels: </VText>
					<VSwitch_Auto text="1" path={()=>node.p.channel1}/>
					<VSwitch_Auto text="2" path={()=>node.p.channel2}/>
					<VSwitch_Auto text="3" path={()=>node.p.channel3}/>
					<VSwitch_Auto text="4" path={()=>node.p.channel4}/>
				</Row>
			</Column>
		)
	}
}