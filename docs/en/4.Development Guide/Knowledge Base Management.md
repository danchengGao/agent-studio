# Knowledge Base Management

Knowledge base is an important way for the openJiuwen platform to manage local knowledge. Users can enhance the agent's knowledge retrieval RAG capabilities by managing local knowledge bases.

## Knowledge Base Types

openJiuwen supports multiple knowledge base types:

| Type       | Description                                                                 |
|------------|-----------------------------------------------------------------------------|
| Document   | Build a knowledge base by uploading local files (e.g., PDF, Word, TXT)      |
| Weblink    | Build a knowledge base by adding web URLs (e.g., web pages, WeChat articles)|

The type must be selected when creating a knowledge base and cannot be changed afterward.

# Create Knowledge Base

## Prerequisites

A usable model has been configured in the **Embedding Model** tab of the **Model Management** module. For how to configure Embedding models, please refer to the Model Management related sections.

## Operation Steps

1. Log in to the openJiuwen platform.

2. Navigate to the **Knowledge Base Management** module in the left sidebar of the platform.

3. Click the **Create Knowledge Base** button.

   ![Create Knowledge Base](./images/ScreenShot_2026-01-06_112802_668.png)

4. In the create knowledge base dialog:
   - Enter the **Knowledge Base Name** and **Description** (optional)
   - Select the **Knowledge Base Type**: **Document** or **Weblink**
   - Select a model from the **Embedding Model** dropdown (Note: The Embedding model cannot be changed after the knowledge base is created)
   - Click **Create**
   
   ![Configure Knowledge Base Information](./images/ScreenShot_2026-01-06_112744_102.png)

5. For **Document** knowledge bases: On the created knowledge base card, click the **Edit** button.
   
   ![Edit Knowledge Base](./images/ScreenShot_2026-01-06_112937_403.png)

6. On the edit knowledge base page, click **Add Document**.

   ![Add Document](./images/ScreenShot_2026-01-06_113128_652.png)

7. In the add document dialog, select the files you want to upload to the knowledge base by dragging or clicking **Select Files** (multiple files can be selected), then click **Next**.

   ![Upload Document](./images/ScreenShot_2026-01-06_113207_585.png)

8. On the document parameters page, configure document parsing and indexing parameters, then click **Next**.

   ![Document Parameters](./images/ScreenShot_2026-01-06_113745_822.png)

   The document parameter configuration descriptions are as follows:

   | Parameter Name     | Description                  | Configuration Instructions                                                                                                                                    |
   |----------|---------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
   | Parsing Strategy     | Controls the document parsing method           | - **Quick Parsing**: Uses default parsing strategy to quickly process documents, suitable for most scenarios<br>- **Note**: Currently only quick parsing mode is supported                                                                               |
   | Segmentation Strategy     | Controls the document text segmentation method         | - **Auto Segmentation and Cleaning**: System automatically performs text segmentation and cleaning, suitable for most scenarios<br>- **Custom**: Manually configure segmentation parameters for precise control of segmentation effects<br>- **Note**: After selecting "Custom", you need to configure sub-parameters: Maximum Tokens and Segmentation Overlap Percentage                        |
   | Maximum Tokens | Maximum number of tokens per segment (sub-parameter) | - **Function**: Controls the length of each text segment<br>- **Range**: 16-1024<br>- **Default Value**: 512<br>- **Display Condition**: Only displayed when segmentation strategy is set to "Custom"<br>- **Recommendation**: Set according to document type and retrieval needs. Too small may lose context, too large may affect retrieval accuracy |
   | Segmentation Overlap Percentage  | Overlap ratio between adjacent segments (sub-parameter)    | - **Function**: Controls the overlap degree between segments to maintain context coherence<br>- **Range**: 0-50<br>- **Default Value**: 10<br>- **Display Condition**: Only displayed when segmentation strategy is set to "Custom"<br>- **Recommendation**: Usually set to 10-20, can be adjusted according to document characteristics         |
   | Document Graph Construction    | Whether to build document graph             | - **Function**: After enabling, document graph index can be built to improve complex relationship retrieval effects<br>- **Note**: Enabling document graph will increase index construction time and consume additional LLM tokens<br>- **Note**: After enabling, you need to configure the sub-parameter LLM model                                 |
   | LLM Model    | Large language model used for document graph construction (sub-parameter)  | - **Function**: Model used to extract entities and relationships during document graph index construction<br>- **Display Condition**: Only displayed when document graph construction is enabled, and must be selected<br>- **Recommendation**: Choose a model with stable performance and support for long text                                         |                         |

9. After that, documents will be processed one by one. You can click **Refresh Status** to get the latest document status, and the page will automatically refresh document status. You can cancel automatic refresh by clicking **Stop Auto-refreshing Document Status**.

   ![Document Indexing](./images/ScreenShot_2026-01-06_145019_393.png)

10. Indexed documents will display **Indexed**, and documents with document graph construction enabled will have a **Graph Enhanced** label, while those without will not. If you still need to upload documents, you can continue by clicking **Add Document** in the upper right corner.

   ![Document Indexing Complete](./images/ScreenShot_2026-01-06_143042_263.png)

# Weblink Knowledge Base

Weblink knowledge bases allow you to build a knowledge base by adding web URLs. They are suitable for web pages, WeChat public account articles, and other online content. The system fetches web content, parses it, segments it, and builds indexes for agent retrieval.

## Create a Weblink Knowledge Base

1. Log in to the openJiuwen platform and go to **Knowledge Base Management**.

2. Click the **Create Knowledge Base** button.

3. In the create knowledge base dialog:
   - Enter the **Knowledge Base Name** and **Description** (optional)
   - Select **Weblink** as the **Knowledge Base Type**
   - Select an **Embedding Model**
   - Click **Create**

4. On the created knowledge base card, click the **Edit** button to open the editor.

## Add Web Links

1. On the knowledge base editor page, click the **Add Link** button.

2. In the "Add Web Links" dialog, enter one URL per line. Both http:// and https:// links are supported (e.g., web pages, WeChat public account articles).

   - **Format**: URLs must start with `http://` or `https://`
   - **Limit**: Up to 50 URLs per batch
   - After entering URLs, click **Add and Next**

3. On the "Link Parameters" page, configure parsing and indexing parameters, then complete to start processing.

   | Parameter Name     | Description                  | Configuration Instructions                                                                                                                                     |
   |--------------------|------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
   | Parsing Strategy   | Controls how web pages are parsed | - **Quick Parsing**: Uses default parsing for fast processing, suitable for most scenarios<br>- **Note**: Currently only quick parsing is supported              |
   | Segmentation Strategy | Controls text segmentation   | - **Auto Segmentation and Cleaning**: Automatic segmentation and cleaning<br>- **Custom**: Manually configure segmentation; set Maximum Tokens and Overlap %      |
   | Maximum Tokens     | Max tokens per segment (sub-parameter) | - **Range**: 16-1024<br>- **Default**: 512                                                                                                              |
   | Segmentation Overlap % | Overlap ratio between segments (sub-parameter) | - **Range**: 0-50<br>- **Default**: 10                                                                                                              |
   | Document Graph Construction | Whether to build document graph | - **Function**: Enables graph index for better complex-relation retrieval<br>- **Note**: Increases build time and LLM token usage<br>- **Note**: Requires selecting an LLM model when enabled |
   | LLM Model         | LLM for document graph (sub-parameter) | - **Function**: Extracts entities and relations during graph index build<br>- **Display**: Shown only when graph construction is enabled; required when enabled  |

4. Links are processed one by one. You can click **Refresh Status** to get the latest status; the page also auto-refreshes. Use **Stop Auto-refreshing Link Status** to disable auto-refresh.

5. Indexed links show **Indexed**. Links with document graph enabled show a **Graph Enhanced** label. To add more links, click **Add Link**.

## Manage Links

- **Rename**: Click a link name in the list to edit it.
- **Delete**: Select one or multiple links, then delete.
- **Refresh**: Click **Refresh** to update a single link; click **Refresh All** for batch update. On first load or refresh, the system tries to parse the page title from the URL and update the link name.

## Notes

- The knowledge base type cannot be changed after creation.
- Ensure target URLs are publicly accessible; otherwise content may not be fetched.
- WeChat public account articles and similar pages must be viewable in a browser; the system parses them as web pages.
- Link processing runs asynchronously; processing time depends on page size and complexity.
