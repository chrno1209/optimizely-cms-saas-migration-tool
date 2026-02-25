import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import {
   Alert,
   Button,
   Card,
   Empty,
   Form,
   Input,
   Modal,
   Space,
   Typography,
} from "antd";
import { useState } from "react";
import { EnvironmentConfig } from "../types";
import { storageKeys } from "../utils/localStorage";

type Props = {
   environments: EnvironmentConfig[];
   onAdd: (environment: Omit<EnvironmentConfig, "id">) => void;
   onEdit: (environment: EnvironmentConfig) => void;
   onDelete: (id: string) => void;
};

type FormValues = {
   name: string;
   clientId: string;
   clientSecret: string;
};

export const EnvironmentManager = ({
   environments,
   onAdd,
   onEdit,
   onDelete,
}: Props) => {
   const [form] = Form.useForm<FormValues>();
   const [isOpen, setIsOpen] = useState(false);
   const [editing, setEditing] = useState<EnvironmentConfig | null>(null);

   const openCreate = () => {
      setEditing(null);
      form.resetFields();
      setIsOpen(true);
   };

   const openEdit = (environment: EnvironmentConfig) => {
      setEditing(environment);
      form.setFieldsValue({
         name: environment.name,
         clientId: environment.clientId,
         clientSecret: environment.clientSecret,
      });
      setIsOpen(true);
   };

   const handleSubmit = async () => {
      const values = await form.validateFields();
      if (editing) {
         onEdit({ ...editing, ...values });
      } else {
         onAdd(values);
      }
      setIsOpen(false);
   };

   return (
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>

         <Alert
            type="warning"
            showIcon
            title={`Client secrets are stored as plain text in browser localStorage. Storage key: ${storageKeys.environments}`}
         />

         
         <Space style={{ width: "100%", justifyContent: "end" }}>
            {/* <Typography.Title level={5} style={{ margin: 0 }}>
               Environments
            </Typography.Title> */}
            <Button
               type="primary"
               icon={<PlusOutlined />}
               onClick={openCreate}
               size="small"
            >
               Add
            </Button>
         </Space>

         {environments.length === 0 ? (
            <Card size="small">
               <Empty description="No environments saved yet" />
            </Card>
         ) : (
            <Space
               orientation="vertical"
               size="small"
               style={{ width: "100%" }}
            >
               {environments.map((environment) => (
                  <Card
                     key={environment.id}
                     size="small"
                     title={environment.name}
                     extra={
                        <Space>
                           <Button
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => openEdit(environment)}
                           >
                              Edit
                           </Button>
                           <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => onDelete(environment.id)}
                           >
                              Delete
                           </Button>
                        </Space>
                     }
                  >
                     <Space
                        orientation="vertical"
                        size={2}
                        style={{ width: "100%" }}
                     >
                        <Typography.Text>
                           <Typography.Text type="secondary">
                              Client ID:{" "}
                           </Typography.Text>
                           {environment.clientId}
                        </Typography.Text>
                        <Typography.Text>
                           <Typography.Text type="secondary">
                              Client Secret:{" "}
                           </Typography.Text>
                           {"•".repeat(
                              Math.max(
                                 8,
                                 String(environment.clientSecret).length,
                              ),
                           )}
                        </Typography.Text>
                     </Space>
                  </Card>
               ))}
            </Space>
         )}

         <Modal
            title={editing ? "Edit Environment" : "Add Environment"}
            open={isOpen}
            onCancel={() => setIsOpen(false)}
            onOk={handleSubmit}
            okText={editing ? "Update" : "Create"}
         >
            <Form<FormValues> form={form} layout="vertical">
               <Form.Item
                  name="name"
                  label="Environment Name"
                  rules={[
                     {
                        required: true,
                        message: "Environment name is required.",
                     },
                  ]}
               >
                  <Input placeholder="Dev / UAT / Production" />
               </Form.Item>
               <Form.Item
                  name="clientId"
                  label="Client ID"
                  rules={[
                     { required: true, message: "Client ID is required." },
                  ]}
               >
                  <Input placeholder="Client ID" />
               </Form.Item>
               <Form.Item
                  name="clientSecret"
                  label="Client Secret"
                  rules={[
                     { required: true, message: "Client secret is required." },
                  ]}
               >
                  <Input.Password placeholder="Client Secret" />
               </Form.Item>
            </Form>
         </Modal>
      </Space>
   );
};
