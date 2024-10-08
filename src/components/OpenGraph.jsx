import { Helmet } from 'react-helmet';

const OpenGraph = () => { 
    return ( 
      <div> 
        <Helmet> 
          <meta property="og:title" content="Thai celebrity pygmy hippo Moo-Deng gets shot by vistor, in critical condition" /> 
          {/* <meta property="og:description" content="Description of your content." />  */}
          <meta property="og:image" content="https://www.hindustantimes.com/ht-img/img/2024/09/16/550x309/Moo_Deng_1726453915615_1726453915979.jpg"/> 
          {/* <meta property="og:url" content="https://nypost.com/" /> 
          <meta property="og:type" content="website" />  */}
        </Helmet> 
      </div> 
    ); 
  };

  export default OpenGraph