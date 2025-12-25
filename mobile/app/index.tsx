import { View, ActivityIndicator } from 'react-native';
import tw from 'twrnc';

export default function Index() {
    return (
        <View style={tw`flex-1 justify-center items-center bg-white`}>
            <ActivityIndicator size="large" color="#2563eb" />
        </View>
    );
}
